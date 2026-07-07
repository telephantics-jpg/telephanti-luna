@echo off
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"
echo.
echo  Telephanti.com local setup for Luna
echo  (needs Administrator once - click Yes on the prompt)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"\"%ROOT%\scripts\setup_telephanti_local.ps1\"\"'"
pause