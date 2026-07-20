# Upload PHP bridge hotfix to pro.agi.vn
# Usage:
#   .\deploy\push-bridge-hotfix.ps1
#   .\deploy\push-bridge-hotfix.ps1 -PrintBootstrapCommand

param(
    [string]$BaseUrl = 'https://pro.agi.vn/api/platform',
    [string]$MigrateKey = 'toc-migrate-2026',
    [string[]]$Files = @('job-create.php', 'hotfix-upload.php', 'migrate-jobs.php'),
    [switch]$PrintBootstrapCommand
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$bridgeDir = Join-Path $repoRoot 'server\php-bridge'

function Print-BootstrapCommand {
    $bootstrapPath = Join-Path $bridgeDir 'hotfix-upload.php'
    if (-not (Test-Path $bootstrapPath)) {
        throw "Missing $bootstrapPath"
    }
    $content = Get-Content $bootstrapPath -Raw -Encoding UTF8
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($content))

    Write-Host @"

=== aaPanel TERMINAL (SSH) - paste 1 lan ===

# Tim thu muc bridge (co login.php):
find /www/wwwroot -name login.php 2>/dev/null | head -5

# Ghi hotfix-upload.php (sua DIR neu find tra ve path khac):
DIR="/www/wwwroot/pro.agi.vn/api/platform"
mkdir -p "`$DIR"
echo '$b64' | base64 -d > "`$DIR/hotfix-upload.php"
php -r "echo file_exists('`$DIR/hotfix-upload.php') ? 'OK hotfix-upload.php' : 'FAIL';"

# Kiem tra endpoint:
curl -s "$BaseUrl/hotfix-upload.php?key=$MigrateKey&ping=1"

Sau do chay lai tren Windows (CMD hoac double-click):
  deploy\push-hotfix.cmd
"@ -ForegroundColor Cyan
}

if ($PrintBootstrapCommand) {
    Print-BootstrapCommand
    exit 0
}

function Push-BridgeFile {
    param([string]$FileName)

    $localPath = Join-Path $bridgeDir $FileName
    if (-not (Test-Path $localPath)) {
        throw "Local file not found: $localPath"
    }

    $bytes = [System.IO.File]::ReadAllBytes($localPath)
    $uriUpload = "$BaseUrl/hotfix-upload.php?key=$MigrateKey&file=$([uri]::EscapeDataString($FileName))"
    $uriMigrate = "$BaseUrl/migrate-jobs.php?key=$MigrateKey&deploy=$([uri]::EscapeDataString($FileName))"

    foreach ($uri in @($uriUpload, $uriMigrate)) {
        try {
            $resp = Invoke-WebRequest -Uri $uri -Method POST -Body $bytes -ContentType 'application/octet-stream' -UseBasicParsing
            $json = $resp.Content | ConvertFrom-Json
            if ($json.success -and $json.data.deployed) {
                Write-Host "[OK] $FileName via $($uri.Split('?')[0]) - $($json.data.bytes) bytes, sha1=$($json.data.sha1)" -ForegroundColor Green
                return $true
            }
            if ($json.success) {
                Write-Host "[SKIP] $FileName - endpoint chua co deploy (response: done/migrate only)" -ForegroundColor DarkYellow
            } else {
                Write-Host "[WARN] $FileName - $($json.message)" -ForegroundColor Yellow
            }
        } catch {
            $status = $null
            if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
            Write-Host "[SKIP] $FileName - $($uri.Split('/api/platform/')[1]) HTTP $status" -ForegroundColor DarkYellow
        }
    }
    return $false
}

Write-Host "=== Push PHP bridge hotfix -> $BaseUrl ===" -ForegroundColor Cyan
Write-Host "Repo: $repoRoot`n"

$failed = @()
foreach ($f in $Files) {
    if (-not (Push-BridgeFile -FileName $f)) {
        $failed += $f
    }
}

Write-Host ""
Write-Host "=== Probe job-create ===" -ForegroundColor Cyan
$probeOk = $false
try {
    $probeResp = Invoke-WebRequest -Uri "$BaseUrl/job-create.php?probe=1" -UseBasicParsing
    Write-Host "HTTP $($probeResp.StatusCode): $($probeResp.Content)"
    if ($probeResp.Content -match '2026-07-20-hotfix2') { $probeOk = $true }
} catch {
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Host "HTTP $([int]$_.Exception.Response.StatusCode): $body"
        if ($body -match '2026-07-20-hotfix2') { $probeOk = $true }
    } else {
        Write-Host "Probe error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

if ($probeOk) {
    Write-Host "`n[SUCCESS] Hotfix deployed. Retry image create at localhost:5173/image" -ForegroundColor Green
    exit 0
}

Write-Host "`n[PENDING] VPS chua co file moi." -ForegroundColor Red
Write-Host "Chay lenh in bootstrap cho aaPanel Terminal:" -ForegroundColor Yellow
Write-Host "  .\deploy\push-bridge-hotfix.ps1 -PrintBootstrapCommand" -ForegroundColor Yellow
Write-Host "Hoac xem: deploy\HUONG-DAN-UPLOAD-NHANH.md" -ForegroundColor Yellow
if ($failed.Count -gt 0) {
    Write-Host "Chua upload duoc: $($failed -join ', ')" -ForegroundColor Red
}
exit 1
