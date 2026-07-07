@echo off
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"
if not exist ".env" if exist ".env.example" copy ".env.example" ".env" >nul
set "PY=C:\Users\Stood\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"
:loop
echo [%date% %time%] Luna server starting on port 8767...
"%PY%" server.py
echo.
echo Server stopped ^(exit %ERRORLEVEL%^) — restarting in 5 seconds...
echo Close this window to stop Luna completely.
timeout /t 5 /nobreak >nul
goto loop