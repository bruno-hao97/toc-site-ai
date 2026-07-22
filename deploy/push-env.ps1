# Upload production.env len VPS qua FTP (remote: /.env)
# Can: deploy\ftp.local.ps1 (copy tu ftp.local.example.ps1)

param(
    [switch]$SkipSync
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
Roi dien FTP_PASSWORD, chay lai deploy\push-env.cmd
"@ -ForegroundColor Yellow
    exit 1
}

. $localCfg

foreach ($name in @('FTP_SERVER', 'FTP_USERNAME', 'FTP_PASSWORD')) {
    if (-not (Get-Variable -Name $name -ErrorAction SilentlyContinue) -or [string]::IsNullOrWhiteSpace((Get-Variable $name).Value)) {
        throw "Thieu bien $name trong deploy\ftp.local.ps1"
    }
}

if (-not $SkipSync) {
    & (Join-Path $PSScriptRoot 'sync-production-env.ps1')
}

$envFile = Join-Path $repoRoot 'production.env'
if (-not (Test-Path $envFile)) {
    throw "Khong thay production.env — chay deploy\sync-production-env.ps1 truoc"
}

$uri = "ftp://${FTP_SERVER}/.env"
$req = [System.Net.FtpWebRequest]::Create($uri)
$req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
$req.Credentials = New-Object System.Net.NetworkCredential($FTP_USERNAME, $FTP_PASSWORD)
$req.UseBinary = $true
$req.UsePassive = $true
$req.KeepAlive = $false

$bytes = [System.IO.File]::ReadAllBytes($envFile)
$req.ContentLength = $bytes.Length
$stream = $req.GetRequestStream()
try {
    $stream.Write($bytes, 0, $bytes.Length)
} finally {
    $stream.Close()
}
$resp = $req.GetResponse()
$resp.Close()

Write-Host @"

[OK] Da upload production.env -> /.env tren VPS.

Tren VPS (SSH), chay de Node/Pay2S nhan env moi:
  cd /www/wwwroot/pro.agi.vn
  pm2 startOrReload deploy/ecosystem.config.cjs --update-env
  pm2 save
  curl -s http://127.0.0.1:3001/api/health
  curl -s https://pro.agi.vn/api/pay2s/status
"@ -ForegroundColor Green
