@echo off
title Open LIVE Luna Camp on Render
cd /d "%~dp0"

echo.
echo  Connecting to Render cloud host...
echo  https://telephanti.com/firmament/play
echo.

REM Prefer public domain; fall back to onrender if needed
curl -s -o nul -m 15 "https://telephanti.com/api/health"
if errorlevel 1 (
  echo  Public domain slow — opening onrender.com direct...
  start "" "https://telephanti-luna.onrender.com/firmament/play?v=265&fresh=%RANDOM%"
) else (
  start "" "https://telephanti.com/firmament/play?v=265&fresh=%RANDOM%"
)

echo  If page spins, wait 30s for free-tier wake, then refresh.
echo  Local free Ollama = START_CAMP_SERVER.bat instead.
echo.
pause
