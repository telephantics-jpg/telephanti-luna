# Saves Luna phone QR + shortcut to Desktop\Luna-Telephanti (same Wi-Fi required on phone).
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"
$Port = 8767
$BaseUrl = "http://127.0.0.1:${Port}"

try {
    $info = Invoke-RestMethod -Uri "$BaseUrl/api/info" -TimeoutSec 8
} catch {
    Write-Error "Luna server not running on port $Port. Start Luna first."
}

$phoneUrl = if ($info.phone_url) { $info.phone_url } else { "$($info.lan_url)/?avatar=1&web=1&mobile=1&v=105" }

try {
    $qrBytes = (Invoke-WebRequest -Uri "$BaseUrl/api/phone/qr" -UseBasicParsing -TimeoutSec 8).Content
} catch {
    Write-Error "Could not fetch QR code from Luna server."
}

$artifacts = Get-LunaArtifactsFolder
$qrPath = Join-Path $artifacts "Luna_Phone_QR.png"
[IO.File]::WriteAllBytes($qrPath, $qrBytes)

$urlPath = Join-Path $artifacts "Luna on Phone.url"
@"
[InternetShortcut]
URL=$phoneUrl
"@ | Set-Content -Path $urlPath -Encoding ASCII

Write-Host "Saved: $qrPath"
Write-Host "Saved: $urlPath"
Write-Host ""
Write-Host "On your phone (same Wi-Fi): open $phoneUrl"
Write-Host "Or scan Luna_Phone_QR.png from Desktop\Luna-Telephanti."