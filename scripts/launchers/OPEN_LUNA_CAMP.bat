@echo off
setlocal EnableDelayedExpansion
title Open Luna Camp
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"

set "PY=C:\Users\Stood\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"

if not exist "%PY%" (
    echo ERROR: Python not found.
    echo Install Python 3.12 or fix the path in this .bat file.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   LUNA CAMP — one-click launcher
echo ========================================
echo.
echo Folder: %ROOT%
echo.

powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:8767/api/health' -TimeoutSec 2; if ($r.ok) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %ERRORLEVEL%==0 (
    echo Server already running on port 8767.
    goto :openbrowser
)

echo Port 8767 is not running — starting Luna server...
echo.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8767" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
)
timeout /t 1 /nobreak >nul

start "Luna Server — KEEP THIS WINDOW OPEN" cmd /k "cd /d %ROOT% && call scripts\launchers\server_keepalive.bat"

echo Waiting for server on port 8767...
set /a TRIES=0
:waitloop
set /a TRIES+=1
if !TRIES! GTR 25 (
    echo.
    echo ERROR: Server did not start after 50 seconds.
    echo Check the "Luna Server" window for Python errors.
    pause
    exit /b 1
)
powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:8767/api/health' -TimeoutSec 2; if ($r.ok) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %ERRORLEVEL%==0 goto :openbrowser
timeout /t 2 /nobreak >nul
goto :waitloop

:openbrowser
echo.
echo Server OK — opening camp in browser...
start "" "http://127.0.0.1:8767/firmament/play"
echo.
echo   Browser:  http://127.0.0.1:8767/firmament/play
echo.
echo IMPORTANT: Leave the black "Luna Server" window OPEN while you play.
echo Closing it stops chat and agents.
echo.
pause