@echo off
title Luna Camp — LOCAL free Ollama brains
cd /d "%~dp0"

echo.
echo  ================================================
echo   LOCAL camp = free Ollama minds (hermes3/llama3.2)
echo   telephanti.com CANNOT see your PC Ollama
echo  ================================================
echo.

REM Make sure Ollama is up
where ollama >nul 2>&1
if errorlevel 1 (
  echo  [!] Ollama not found. Install from https://ollama.com then re-run.
  pause
  exit /b 1
)

curl -s -o nul -m 2 http://127.0.0.1:11434/api/tags
if errorlevel 1 (
  echo  Starting Ollama app...
  start "" "%LOCALAPPDATA%\Programs\Ollama\ollama app.exe"
  timeout /t 4 /nobreak >nul
)

echo  Models expected: hermes3 + llama3.2
ollama list 2>nul

REM Prefer free local brains (no paid Grok for camp chat)
findstr /I /C:"LUNA_LLM_BACKEND=ollama" ".env" >nul 2>&1 || echo LUNA_LLM_BACKEND=ollama>>".env"
findstr /I /C:"LUNA_FREE_BRAINS=1" ".env" >nul 2>&1 || echo LUNA_FREE_BRAINS=1>>".env"
findstr /I /C:"LUNA_FORCE_OLLAMA=1" ".env" >nul 2>&1 || echo LUNA_FORCE_OLLAMA=1>>".env"
findstr /I /C:"LUNA_GROK_FALLBACK=0" ".env" >nul 2>&1 || echo LUNA_GROK_FALLBACK=0>>".env"

echo.
echo  Starting Luna server on this PC...
start "Luna Server (Ollama camp)" cmd /k "cd /d "%~dp0" && python server.py"

echo  Waiting for server...
set /a n=0
:wait
set /a n+=1
curl -s -o nul -m 2 http://127.0.0.1:8767/api/health
if not errorlevel 1 goto open
if %n% geq 40 (
  echo  [!] Server slow — open http://127.0.0.1:8767/firmament/play manually
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait

:open
echo.
echo  Opening LOCAL camp (Ollama brains)...
start "" "http://127.0.0.1:8767/firmament/play?v=263-CAMP-MINDS&fresh=%RANDOM%"
echo.
echo  Look for chip: Ollama live  OR status: online · ollama
echo  Open dock 💬 Chat — replies tag: ollama · hermes3 (free mind)
echo.
echo  Do NOT use telephanti.com for free Ollama — that is cloud only.
echo.
pause
