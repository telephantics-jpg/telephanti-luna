@echo off
title Luna 3D — phone test
cd /d "%~dp0"

set "PY=C:\Users\Stood\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=C:\Users\Stood\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"

echo.
echo  ========================================
echo   TEST 3D CAMP ON YOUR PHONE
echo  ========================================
echo.
echo  1. Phone + PC on the SAME Wi-Fi
echo  2. Server must listen on all interfaces
echo.

set LUNA_HOST=0.0.0.0
"%PY%" "%~dp0_boot8767.py"

echo.
echo  On your phone browser open:
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } ^| Select-Object -First 1).IPAddress"') do set "LAN=%%i"
if defined LAN (
  echo.
  echo     http://%LAN%:8767/firmament/3d
  echo     http://%LAN%:8767/firmament/play
  echo.
) else (
  echo     http://YOUR-PC-IP:8767/firmament/3d
  echo     ^(find PC IP: Settings - Network - Wi-Fi - Properties^)
)
echo  If it fails: Windows Firewall may block Python on private networks.
echo  Allow Python / port 8767 when Windows asks.
echo.
pause
