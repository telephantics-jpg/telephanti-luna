# Enter Render DNS into Squarespace for telephanti.com = Luna
param(
    [string]$RenderHost = "",
    [string]$RenderApexIp = "216.24.57.1"
)

$ErrorActionPreference = "Stop"
$Desktop = [Environment]::GetFolderPath("Desktop")
if (-not (Test-Path $Desktop)) {
    $Desktop = Join-Path $env:USERPROFILE "OneDrive\Desktop"
}

if (-not $RenderHost) {
    $RenderHost = Read-Host "Paste your Render hostname (e.g. telephanti-luna.onrender.com)"
}
$RenderHost = $RenderHost.Trim().TrimEnd(".")

$guide = @"
SQUARESPACE DNS — telephanti.com -> LUNA ON RENDER
==================================================

Open: https://account.squarespace.com/domains
Click: telephanti.com -> DNS Settings -> Custom Records

FIRST: Delete old A / CNAME for @ and www (if they point to Squarespace or Beacons).

THEN add these 2 records:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECORD 1 — root domain (telephanti.com)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Squarespace field     You enter
-----------------     -----------
TYPE                  A
HOST                  @
DATA / IP / Points to $RenderApexIp
TTL                   Default (or 3600)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECORD 2 — www.telephanti.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Squarespace field     You enter
-----------------     -----------
TYPE                  CNAME
HOST                  www
DATA / Points to      $RenderHost
TTL                   Default (or 3600)

Save both. Wait 15–60 minutes (up to 48 hrs).

In Render (must match):
  Settings -> Custom Domains -> add telephanti.com and www.telephanti.com

Test when Render shows Verified:
  https://telephanti.com
  https://www.telephanti.com

Your Render hostname used above: $RenderHost
"@

$outPath = Join-Path $Desktop "Squarespace-DNS-Enter-These.txt"
Set-Content -Path $outPath -Value $guide -Encoding UTF8

Write-Host $guide
Write-Host ""
Write-Host "Saved: $outPath"
Start-Process "https://account.squarespace.com/domains"
explorer.exe /select,"$outPath"