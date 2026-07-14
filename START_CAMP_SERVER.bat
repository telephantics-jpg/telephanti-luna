@echo off
title Luna Camp Server - KEEP THIS WINDOW OPEN
cd /d "%~dp0"
echo.
echo  Starting Luna Camp on this PC...
echo  When you see "Uvicorn running" open:
echo    http://127.0.0.1:8767/firmament/play
echo.
echo  DO NOT CLOSE THIS WINDOW or the site goes offline.
echo.
where python >nul 2>&1
if errorlevel 1 (
  echo Python not found in PATH.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:8767/firmament/play?v=265"
python server.py
echo.
echo Server stopped.
pause
