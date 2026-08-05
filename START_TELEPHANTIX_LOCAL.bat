@echo off
title Telephantix LOCAL ? leave minimized Python windows open
cd /d C:\Users\Stood

set "PY=C:\Users\Stood\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"

echo.
echo  Starting Luna Camp  (port 8767)...
start "Luna Camp 8767" /MIN "%PY%" "C:\Users\Stood\luna-avatar\server.py"

echo  Starting Hub Bio    (port 8765)...
start "Hub Bio 8765" /MIN "%PY%" "C:\Users\Stood\telephantix-demo\server.py"

echo  Waiting for servers...
timeout /t 4 /nobreak >nul

start "" "http://127.0.0.1:8767/firmament/3d"
start "" "http://127.0.0.1:8767/firmament/play"
start "" "http://127.0.0.1:8765/#bio"

echo.
echo  Camp 3D:  http://127.0.0.1:8767/firmament/3d
echo  Camp 2D:  http://127.0.0.1:8767/firmament/play
echo  Hub bio:  http://127.0.0.1:8765/#bio
echo.
echo  Keep the minimized "Luna Camp" and "Hub Bio" windows open.
echo  Close those windows = site dies.
echo.
pause
