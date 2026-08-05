@echo off
title Luna Camp LOCAL ? 2D + 3D (ONE free server)
cd /d C:\Users\Stood\luna-avatar
set "PY=C:\Users\Stood\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"
echo.
echo  Starting ONE free server for 2D + 3D camp...
echo  (No paid cloud required. Leave this window open.)
echo.
start "Luna Camp 8767" /MIN "%PY%" server.py
timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:8767/firmament/play"
start "" "http://127.0.0.1:8767/firmament/3d"
echo  2D:  http://127.0.0.1:8767/firmament/play
echo  3D:  http://127.0.0.1:8767/firmament/3d
echo.
echo  Both pages use THIS same free Python server.
echo  Close the minimized "Luna Camp" window = pages die.
echo.
pause
