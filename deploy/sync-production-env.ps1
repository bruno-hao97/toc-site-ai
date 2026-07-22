# Tao production.env tu .env local (chi override bien production).
# Chay: .\deploy\sync-production-env.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$src = Join-Path $repoRoot '.env'
$dst = Join-Path $repoRoot 'production.env'

if (-not (Test-Path $src)) {
    throw "Khong thay .env o root repo"
}

$overrides = [ordered]@{
    'NODE_ENV'                  = 'production'
    'APP_URL'                   = 'https://pro.agi.vn'
    'AUTH_BRIDGE_URL'           = 'http://127.0.0.1/api/platform'
    'PAY2S_REDIRECT_URL'        = 'https://pro.agi.vn/pricing'
    'PAY2S_IPN_URL'             = 'https://pro.agi.vn/api/pay2s/ipn'
    'ALLOW_MOCK_TOPUP'          = 'false'
    'DEV_RETURN_RESET_LINK'     = 'false'
}

$lines = Get-Content $src -Encoding UTF8
$out = New-Object System.Collections.Generic.List[string]
$seen = @{}

foreach ($line in $lines) {
    if ($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)) {
        $out.Add($line)
        continue
    }
    if ($line -notmatch '^\s*([^=+#\s]+)\s*=\s*(.*)$') {
        $out.Add($line)
        continue
    }
    $key = $Matches[1].Trim()
    $seen[$key] = $true
    if ($overrides.Contains($key)) {
        $out.Add("$key=$($overrides[$key])")
        $overrides.Remove($key)
    } elseif ($key -eq 'DB_HOST' -and $Matches[2].Trim() -eq '14.225.211.21') {
        $out.Add('DB_HOST=127.0.0.1')
    } else {
        $out.Add($line)
    }
}

foreach ($key in $overrides.Keys) {
    if (-not $seen.ContainsKey($key)) {
        $out.Add("$key=$($overrides[$key])")
    }
}

if ($out.Count -gt 0 -and $out[0] -notmatch '^\s*#') {
    $out.Insert(0, '# Auto-generated from .env — deploy/sync-production-env.ps1')
}

Set-Content -Path $dst -Value $out -Encoding UTF8
Write-Host "[OK] Da tao production.env ($dst)" -ForegroundColor Green
Write-Host "Tiep theo: deploy\push-env.cmd (FTP) roi SSH pm2 reload --update-env"
