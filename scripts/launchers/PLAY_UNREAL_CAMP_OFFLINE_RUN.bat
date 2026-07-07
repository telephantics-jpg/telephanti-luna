@echo off
setlocal EnableDelayedExpansion
title Luna Unreal Camp — Offline (Ollama + Server + UE)
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"

set "PY=C:\Users\Stood\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"

echo.
echo ========================================
echo   LUNA UNREAL — OFFLINE (Ollama)
echo ========================================
echo.

if not exist ".env" copy ".env.example" ".env" >nul
findstr /I "LUNA_LLM_BACKEND=ollama" ".env" >nul 2>&1
if errorlevel 1 (
    echo LUNA_LLM_BACKEND=ollama>>".env"
    echo OLLAMA_HOST=http://127.0.0.1:11434>>".env"
    echo OLLAMA_MODEL=llama3.2>>".env"
)

echo [1/3] Ollama...
powershell -NoProfile -Command "try { Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }"
if %ERRORLEVEL% NEQ 0 (
    where ollama >nul 2>&1 || (echo Run scripts\SETUP_OFFLINE_NPCS.bat & pause & exit /b 1)
    start "" ollama app
    timeout /t 5 /nobreak >nul
)

echo [2/3] Luna server (port 8767)...
powershell -NoProfile -Command "try { $h = Invoke-RestMethod 'http://127.0.0.1:8767/api/health' -TimeoutSec 3; if ($h.ok) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %ERRORLEVEL% NEQ 0 (
    start "Luna Server — KEEP OPEN" cmd /k "cd /d %ROOT% && call scripts\launchers\server_keepalive.bat"
    set /a ST=0
    :wait
    set /a ST+=1
    if !ST! GTR 30 (echo Server failed & pause & exit /b 1)
    timeout /t 2 /nobreak >nul
    powershell -NoProfile -Command "try { Invoke-RestMethod 'http://127.0.0.1:8767/api/health' -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }"
    if %ERRORLEVEL% NEQ 0 goto wait
)

echo [3/3] Opening Unreal...
start "" "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe" "%ROOT%\unreal\LunaFirmament\LunaFirmament.uproject" /Engine/Maps/Templates/OpenWorld
echo Leave Luna Server window OPEN. Press PLAY in Unreal.
pause