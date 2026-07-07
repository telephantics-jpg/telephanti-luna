# Desktop Luna — double-click Luna on Desktop runs this (no black server box).
$ErrorActionPreference = "SilentlyContinue"
. "$PSScriptRoot\lib.ps1"
Set-Location $LunaRoot

$pyw = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\pythonw.exe"
if (-not (Test-Path $pyw)) { $pyw = "pythonw" }

# Tray keeps Luna alive near the clock.
$trayRunning = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*luna_tray*"
}
if (-not $trayRunning) {
    Start-Process -FilePath $pyw -ArgumentList "`"$LunaRoot\luna_tray.py`"" -WorkingDirectory $LunaRoot -WindowStyle Hidden
    Start-Sleep -Seconds 1
}

$proc = Start-Process -FilePath $pyw -ArgumentList "`"$LunaRoot\launch_desktop.py`"" -WorkingDirectory $LunaRoot -WindowStyle Hidden -PassThru -Wait
if ($proc.ExitCode -ne 0) {
    $msg = "Desktop Luna is still waking up.`n`nFor browser-only: open telephanti.com/visit`n`nOr wait a few seconds and try Luna.lnk again, or use the tray icon."
    try {
        $ws = New-Object -ComObject WScript.Shell
        $ws.Popup($msg, 12, "Luna", 64) | Out-Null
    } catch {
        Write-Host $msg
    }
    exit 1
}