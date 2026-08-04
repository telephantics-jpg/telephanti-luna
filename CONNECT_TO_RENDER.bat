@echo off
title Connect to Luna on Render (telephanti.com)
cd /d "%~dp0"

set "RENDER=https://telephanti-luna.onrender.com"
set "PUBLIC=https://telephanti.com"

echo.
echo  ================================================
echo   Connect PC browser to RENDER cloud host
echo   Render:  %RENDER%
echo   Public:  %PUBLIC%
echo  ================================================
echo.

echo  Checking Render health...
curl -s -m 40 "%RENDER%/api/health" > "%TEMP%\luna_render_health.json" 2>nul
if errorlevel 1 (
  echo  [!] Render not answering yet — free tier may be waking up.
  echo      Wait 30-60s and run this again, or open the URL below.
) else (
  echo  Render health:
  type "%TEMP%\luna_render_health.json"
  echo.
)

echo.
echo  Opening LIVE camp on your Render host...
echo  %PUBLIC%/firmament/play?v=render
echo.
start "" "%PUBLIC%/firmament/play?v=render&fresh=%RANDOM%"
timeout /t 2 /nobreak >nul
start "" "%RENDER%/firmament/play?v=render&fresh=%RANDOM%"

echo.
echo  Use the telephanti.com tab if DNS works.
echo  Use the onrender.com tab if custom domain is slow.
echo.
echo  NOTE: Render has cloud brains (Grok/API keys).
echo  Free Ollama on THIS PC = START_CAMP_SERVER.bat + 127.0.0.1
echo.
pause
