# One-command local dev with a fresh public tunnel for Apparel VTO.
#
#   npm run dev:live
#
# Order matters: cloudflared prints its URL within a few seconds even before the
# dev server is up, so we (1) start the tunnel, (2) capture the fresh URL,
# (3) write it to .env.local, then (4) start `next dev` which reads that env at
# boot. This guarantees PUBLIC_BASE_URL always matches the live tunnel — no more
# stale-URL "couldn't reach your photo / garment" errors.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$cf = Join-Path $root "cloudflared.exe"
if (-not (Test-Path $cf)) {
  Write-Host "cloudflared.exe not found in project root." -ForegroundColor Red
  exit 1
}

# Kill any old tunnels so we don't end up with several dead URLs.
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$log = Join-Path $env:TEMP "derma-cf.log"
Remove-Item $log -ErrorAction SilentlyContinue

Write-Host "Starting cloudflared tunnel..." -ForegroundColor Cyan
$proc = Start-Process -FilePath $cf `
  -ArgumentList "tunnel", "--url", "http://localhost:3000" `
  -RedirectStandardError $log -RedirectStandardOutput "$log.out" `
  -PassThru -WindowStyle Hidden

# Poll for the printed https URL (up to ~25s).
$url = $null
for ($i = 0; $i -lt 25; $i++) {
  Start-Sleep -Seconds 1
  $m = Select-String -Path $log, "$log.out" -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($m) { $url = $m.Matches[0].Value; break }
}

if (-not $url) {
  Write-Host "Could not get a tunnel URL. Check $log" -ForegroundColor Red
  if ($proc) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  exit 1
}
Write-Host "Tunnel up: $url" -ForegroundColor Green

# Upsert PUBLIC_BASE_URL in .env.local (create the file if missing).
$envFile = Join-Path $root ".env.local"
if (Test-Path $envFile) {
  $lines = Get-Content $envFile | Where-Object { $_ -notmatch "^\s*PUBLIC_BASE_URL\s*=" }
} else {
  $lines = @()
}
$lines += "PUBLIC_BASE_URL=$url"
Set-Content -Path $envFile -Value $lines -Encoding UTF8
Write-Host "Wrote PUBLIC_BASE_URL to .env.local" -ForegroundColor Green

Write-Host "`nStarting dev server. Open http://localhost:3000  (Ctrl+C to stop)`n" -ForegroundColor Cyan
try {
  & npm run dev
}
finally {
  # Clean up the tunnel when the dev server stops.
  if ($proc) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  Write-Host "`nTunnel stopped." -ForegroundColor DarkGray
}
