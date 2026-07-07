@echo off
title Luna Unreal Camp — telephanti.com
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"

echo.
echo ========================================
echo   OPENING LUNA UNREAL (cloud brain)
echo ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\open_unreal_camp.ps1" -Mode cloud
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo FAILED — see error above.
    echo Try: scripts\CLICK_ME_OPEN_OPENWORLD.bat  (editor only)
    pause
    exit /b 1
)

echo.
echo Unreal should be opening. Press PLAY in the editor.
pause