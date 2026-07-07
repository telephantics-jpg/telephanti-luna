@echo off
title Luna Unreal Camp — Offline Ollama
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"

echo.
echo ========================================
echo   OPENING LUNA UNREAL (offline Ollama)
echo ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\set_unreal_brain.ps1" -Mode local
if %ERRORLEVEL% NEQ 0 (
    pause
    exit /b 1
)

call "%~dp0PLAY_UNREAL_CAMP_OFFLINE_RUN.bat"