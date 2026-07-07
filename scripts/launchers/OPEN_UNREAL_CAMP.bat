@echo off
title Open Luna Unreal (quick)
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\open_unreal_camp.ps1" -Mode editor-only
pause