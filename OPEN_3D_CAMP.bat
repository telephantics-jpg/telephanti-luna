@echo off
title Luna 3D Camp
cd /d "%~dp0"

set "PY=C:\Users\Stood\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=C:\Users\Stood\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"

echo.
echo  Starting Luna server + 3D camp...
echo.

"%PY%" "%~dp0_boot8767.py"
if errorlevel 1 (
  echo.
  echo  Boot failed. Opening server window so you can see the error...
  start "Luna Server" cmd /k "cd /d "%~dp0" && "%PY%" server.py"
  timeout /t 5 /nobreak >nul
  start "" "http://127.0.0.1:8767/firmament/3d"
)

echo.
echo  If browser says cannot reach site:
echo    1. Look for a Python / Luna server window — keep it open
echo    2. Use exactly:  http://127.0.0.1:8767/firmament/3d
echo       (not https, not telephanti.com for local)
echo.
timeout /t 6 /nobreak >nul
