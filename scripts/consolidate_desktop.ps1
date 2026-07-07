# Moves scattered Luna/Telephanti files on Desktop into Desktop\Luna-Telephanti.
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

$artifacts = Get-LunaArtifactsFolder
$roots = Get-LunaDesktopRoots

$moveNames = @(
    "Connect-Telephanti-Beacons.txt",
    "Deploy-Telephanti-Luna-Live.txt",
    "Go-Live-Telephanti.txt",
    "Luna-Beacons-Setup.txt",
    "Squarespace-Telephanti-Beacons.txt",
    "Squarespace-DNS-Enter-These.txt",
    "Telephanti.url",
    "Luna (Browser).url",
    "Luna on Phone.url",
    "Luna Companion.lnk",
    "Luna-Android.zip",
    "Luna.apk",
    "Luna-Install.apk",
    "Luna-Phone-Install.zip",
    "Luna_Phone_QR.png",
    "INSTALL-ANDROID.txt",
    "RESTART_LUNA_SERVER.bat",
    "SETUP Telephanti.bat"
)

$moved = 0
foreach ($desk in $roots) {
    foreach ($name in $moveNames) {
        $src = Join-Path $desk $name
        if (-not (Test-Path $src)) { continue }
        $dest = Join-Path $artifacts $name
        if ((Resolve-Path $src).Path -eq (Resolve-Path $artifacts -ErrorAction SilentlyContinue).Path) { continue }
        if (Test-Path $dest) { Remove-Item $dest -Force }
        Move-Item -Path $src -Destination $artifacts -Force
        Write-Host "Moved: $name"
        $moved++
    }
}

$readme = Join-Path $artifacts "README.txt"
if (-not (Test-Path $readme)) {
    @"
Luna + Telephanti files live here (guides, APKs, phone QR, browser links).
Double-click Luna.lnk on your Desktop to open the desktop companion.
Camp in browser: https://telephanti.com/visit  or  http://127.0.0.1:8767/firmament/play
"@ | Set-Content -Path $readme -Encoding UTF8
    Write-Host "Created: $readme"
}

Write-Host ""
Write-Host "Done. Luna-Telephanti folder: $artifacts"
Write-Host "Moved $moved item(s). Luna.lnk stays on the Desktop."