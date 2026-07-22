@echo off
title FREE Luna Camp 3D (Ollama - no xAI bill)
cd /d "%~dp0"
echo.
echo  FREE 3D CAMP — uses this PC only (Ollama)
echo  Will NOT open telephanti.com (that cloud can bill xAI)
echo.
echo  1) Waking Ollama if needed...
where ollama >nul 2>&1
if not errorlevel 1 (
  start "" /min ollama serve
)

echo  2) Checking Luna server on port 8767...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8767/api/health' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo  Starting Luna server — keep the new window OPEN...
  start "Luna Camp Server - KEEP OPEN" cmd /k "cd /d "%~dp0" && python server.py"
  echo  Waiting for server...
  timeout /t 4 /nobreak >nul
  powershell -NoProfile -Command "$ok=$false; 1..20 | ForEach-Object { try { Invoke-WebRequest -Uri 'http://127.0.0.1:8767/api/health' -UseBasicParsing -TimeoutSec 2 | Out-Null; $ok=$true; break } catch { Start-Sleep -Seconds 1 } }; if (-not $ok) { exit 1 }"
  if errorlevel 1 (
    echo  Server did not start. Check Python / server window errors.
    pause
    exit /b 1
  )
)

echo  3) Opening FREE 3D meadow...
start "" "http://127.0.0.1:8767/firmament/3d?v=v32-bootfix"
echo.
echo  If blank: Ctrl+Shift+R
echo  Health should say ollama_ok true — free minds.
echo.
timeout /t 3 /nobreak >nul
