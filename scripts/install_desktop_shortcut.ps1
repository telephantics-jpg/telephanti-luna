# Installs Luna desktop shortcut + optional friendly URL (luna.local).
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"
$Launcher = Join-Path $LunaScripts "Launch_Luna.vbs"
$Icon = Join-Path $LunaRoot "static\icons\luna.ico"
$LunaUrl = "http://127.0.0.1:8767/luna"
$PrettyHost = "luna.local"

if (-not (Test-Path $Launcher)) {
    Write-Error "Missing launcher: $Launcher"
}

Write-Host "Generating Luna icon..."
Push-Location $LunaRoot
python make_icons.py
Pop-Location

if (-not (Test-Path $Icon)) {
    Write-Error "Icon not created: $Icon"
}

$artifacts = Get-LunaArtifactsFolder
$desktops = Get-LunaDesktopRoots
$Wsh = New-Object -ComObject WScript.Shell

foreach ($desk in $desktops) {
    $lnk = Join-Path $desk "Luna.lnk"
    $sc = $Wsh.CreateShortcut($lnk)
    $sc.TargetPath = $Launcher
    $sc.WorkingDirectory = $LunaRoot
    $sc.WindowStyle = 7
    $sc.Description = "Open Luna desktop companion with 3D avatar, voice, and tray"
    $sc.IconLocation = "$Icon,0"
    $sc.Save()
    Write-Host "Desktop pet shortcut: $lnk"

    foreach ($oldName in @("Luna Companion.lnk", "Luna Avatar.lnk", "Luna Companion.url")) {
        $old = Join-Path $desk $oldName
        if (Test-Path $old) {
            Remove-Item $old -Force
            Write-Host "Removed old shortcut: $old"
        }
    }
}

$urlPath = Join-Path $artifacts "Luna (Browser).url"
@"
[InternetShortcut]
URL=$LunaUrl
IconFile=$Icon
IconIndex=0
"@ | Set-Content -Path $urlPath -Encoding ASCII
Write-Host "Browser shortcut:   $urlPath -> $LunaUrl"

# Optional friendly hostname (needs admin once).
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$hostsLine = "127.0.0.1 $PrettyHost"
try {
    $hosts = Get-Content $hostsPath -ErrorAction Stop
    if ($hosts -notmatch [regex]::Escape($PrettyHost)) {
        $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
            [Security.Principal.WindowsBuiltInRole]::Administrator
        )
        if ($isAdmin) {
            Add-Content -Path $hostsPath -Value "`n$hostsLine"
            Write-Host "Added hosts entry: $hostsLine"
            Write-Host "Pretty URL: http://${PrettyHost}:8767/luna"
        } else {
            Write-Host "Tip: run this script as Administrator once to enable http://${PrettyHost}:8767/luna"
            Write-Host "For now use: $LunaUrl"
        }
    } else {
        Write-Host "Pretty URL ready: http://${PrettyHost}:8767/luna"
    }
} catch {
    Write-Host "Using URL: $LunaUrl"
}

Write-Host ""
Write-Host "Centering Luna icon on desktop..."
Push-Location $LunaRoot
python center_luna_desktop.py
Pop-Location

Write-Host ""
Write-Host "Done - double-click Luna on your Desktop (center)."
Write-Host "  Pet:     Luna.lnk"
Write-Host "  Browser: Luna-Telephanti\Luna (Browser).url  ($LunaUrl)"