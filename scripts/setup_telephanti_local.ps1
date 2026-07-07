# Setup local telephanti.com -> Luna (hosts + port 80 proxy). Run as Administrator.
#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"
$HostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$HostsLine = "127.0.0.1 telephanti.com"
$Domain = "telephanti.com"
$LunaUrl = "http://telephanti.com/luna"
$Icon = Join-Path $LunaRoot "static\icons\luna.ico"
$py = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
if (-not (Test-Path $py)) { $py = "python" }

Write-Host "Setting up $Domain for Luna..."

$hosts = Get-Content $HostsPath -ErrorAction Stop
if ($hosts -notmatch [regex]::Escape($Domain)) {
    Add-Content -Path $HostsPath -Value "`n$HostsLine"
    Write-Host "Added hosts: $HostsLine"
} else {
    Write-Host "Hosts entry already present for $Domain"
}

$taskName = "LunaTelephantiProxy"
$vbs = Join-Path $LunaScripts "start_telephanti_proxy.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force -RunLevel Highest | Out-Null
Write-Host "Scheduled proxy at logon: $taskName"

Start-Process wscript.exe -ArgumentList "`"$vbs`"" -WindowStyle Hidden
Start-Sleep -Seconds 2

if (-not (Test-Path $Icon)) {
    Push-Location $LunaRoot
    & $py make_icons.py
    Pop-Location
}

$artifacts = Get-LunaArtifactsFolder
$urlPath = Join-Path $artifacts "Telephanti.url"
@"
[InternetShortcut]
URL=$LunaUrl
IconFile=$Icon
IconIndex=0
"@ | Set-Content -Path $urlPath -Encoding ASCII
Write-Host "Browser shortcut: $urlPath"

Set-Content -Path (Join-Path $LunaRoot ".telephanti_enabled") -Value $LunaUrl -Encoding ASCII

Write-Host ""
Write-Host "Done!"
Write-Host "  Open Luna:  $LunaUrl"
Write-Host "  Folder:     $artifacts\Telephanti.url"
try {
    $test = Invoke-WebRequest -Uri $LunaUrl -MaximumRedirection 0 -UseBasicParsing -TimeoutSec 6
    Write-Host "Test OK: $LunaUrl ($($test.StatusCode))"
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 302) {
        Write-Host "Test OK: $LunaUrl (redirects to Luna)"
    } else {
        Write-Host "Note: start Luna first (Luna.lnk), then open $LunaUrl"
    }
}