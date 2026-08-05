@echo off
title Telephantix LOCAL ? leave this window open
cd /d C:\Users\Stood

set "PY=C:\Users\Stood\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"

echo.
echo  Starting Luna Camp on http://127.0.0.1:8767 ...
start "Luna Camp 8767" /MIN "%PY%" "C:\Users\Stood\luna-avatar\server.py"

echo  Starting Hub Bio on http://127.0.0.1:8765 ...
start "Hub Bio 8765" /MIN "%PY%" "C:\Users\Stood\telephantix-demo\server.py"

timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:8767/firmament/3d"
start "" "http://127.0.0.1:8765/#bio"

echo.
echo  Camp:  http://127.0.0.1:8767/firmament/3d
echo  2D:    http://127.0.0.1:8767/firmament/play
echo  Bio:   http://127.0.0.1:8765/#bio
echo.
echo  Keep the minimized Python windows open.
echo  Close this window anytime ? servers keep running until you kill them.
echo.
pause
