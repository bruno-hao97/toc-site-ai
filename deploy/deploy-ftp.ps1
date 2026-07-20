# Build + upload dist + PHP bridge qua FTP (local one-click).
# Cách dùng:
#   1) Copy deploy/ftp.local.example.ps1 → deploy/ftp.local.ps1 và điền mật khẩu
#   2) .\deploy\deploy-ftp.ps1
#
# Không upload config.local.php.

param(
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

$localCfg = Join-Path $PSScriptRoot 'ftp.local.ps1'
if (-not (Test-Path $localCfg)) {
    Write-Host @"
Thieu deploy\ftp.local.ps1

Copy:
  copy deploy\ftp.local.example.ps1 deploy\ftp.local.ps1
Roi dien FTP_SERVER / FTP_USERNAME / FTP_PASSWORD, chay lai.
"@ -ForegroundColor Yellow
    exit 1
}

. $localCfg

foreach ($name in @('FTP_SERVER', 'FTP_USERNAME', 'FTP_PASSWORD')) {
    if (-not (Get-Variable -Name $name -ErrorAction SilentlyContinue) -or [string]::IsNullOrWhiteSpace((Get-Variable $name).Value)) {
        throw "Thieu bien $name trong deploy\ftp.local.ps1"
    }
}

if (-not $SkipBuild) {
    Write-Host "==> npm run build" -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }
}

$dist = Join-Path $repoRoot 'dist'
if (-not (Test-Path (Join-Path $dist 'index.html'))) {
    throw "Khong thay dist\index.html — chay build truoc"
}

$bridgeStaging = Join-Path $repoRoot 'deploy\bridge-upload'
if (Test-Path $bridgeStaging) { Remove-Item $bridgeStaging -Recurse -Force }
New-Item -ItemType Directory -Path $bridgeStaging | Out-Null

$exclude = @(
    'config.local.php',
    'config.local.example.php',
    'hotfix-upload.php',
    '.gitignore'
)
Get-ChildItem (Join-Path $repoRoot 'server\php-bridge') -File | Where-Object {
    $exclude -notcontains $_.Name
} | ForEach-Object {
    Copy-Item $_.FullName -Destination $bridgeStaging -Force
}

function Upload-FtpFile {
    param(
        [string]$LocalPath,
        [string]$RemotePath
    )

    $uri = "ftp://${FTP_SERVER}$RemotePath"
    $req = [System.Net.FtpWebRequest]::Create($uri)
    $req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
    $req.Credentials = New-Object System.Net.NetworkCredential($FTP_USERNAME, $FTP_PASSWORD)
    $req.UseBinary = $true
    $req.UsePassive = $true
    $req.KeepAlive = $false

    $bytes = [System.IO.File]::ReadAllBytes($LocalPath)
    $req.ContentLength = $bytes.Length
    $stream = $req.GetRequestStream()
    try {
        $stream.Write($bytes, 0, $bytes.Length)
    } finally {
        $stream.Close()
    }
    $resp = $req.GetResponse()
    $resp.Close()
}

function Ensure-FtpDirectory {
    param([string]$RemoteDir)

    $uri = "ftp://${FTP_SERVER}$RemoteDir"
    try {
        $req = [System.Net.FtpWebRequest]::Create($uri)
        $req.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
        $req.Credentials = New-Object System.Net.NetworkCredential($FTP_USERNAME, $FTP_PASSWORD)
        $req.UsePassive = $true
        $resp = $req.GetResponse()
        $resp.Close()
    } catch {
        # thu muc da ton tai — bo qua
    }
}

Write-Host "==> Upload webroot (dist → /)" -ForegroundColor Cyan
Ensure-FtpDirectory '/assets'
Get-ChildItem $dist -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($dist.Length).Replace('\', '/')
    if (-not $rel.StartsWith('/')) { $rel = "/$rel" }
    Write-Host "  PUT $rel"
    Upload-FtpFile -LocalPath $_.FullName -RemotePath $rel
}

Write-Host "==> Upload PHP bridge (→ /api/platform/)" -ForegroundColor Cyan
Ensure-FtpDirectory '/api'
Ensure-FtpDirectory '/api/platform'
Get-ChildItem $bridgeStaging -File | ForEach-Object {
    $remote = "/api/platform/$($_.Name)"
    Write-Host "  PUT $remote"
    Upload-FtpFile -LocalPath $_.FullName -RemotePath $remote
}

Write-Host @"

[OK] Deploy xong.
Kiem tra:
  https://pro.agi.vn
  https://pro.agi.vn/api/platform/job-create.php?probe=1
"@ -ForegroundColor Green
