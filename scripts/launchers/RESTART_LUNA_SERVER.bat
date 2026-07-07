@echo off
setlocal EnableDelayedExpansion
title Luna Server (restart)
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"

set "PY=C:\Users\Stood\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"

echo Stopping any old Luna server on port 8767...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8767" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo.
echo ========================================
echo   LUNA SERVER
echo ========================================
echo PC:    http://127.0.0.1:8767/firmament/play
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } ^| Select-Object -First 1).IPAddress"') do set "LAN=%%i"
if defined LAN echo Phone: http://!LAN!:8767/firmament/play  (same Wi-Fi)
echo.
echo Keep this window OPEN while you play.
echo.

start "" /MIN cmd /c "timeout /t 6 /nobreak >nul && start http://127.0.0.1:8767/firmament/play"
echo Starting Python server...
"%PY%" server.py
echo.
echo Server stopped (exit code %ERRORLEVEL%).
echo If you did not mean to close it, double-click OPEN_LUNA_CAMP.bat
pause