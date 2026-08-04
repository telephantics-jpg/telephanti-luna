@echo off
cd /d "C:\Users\Stood\luna-avatar"
set PORT=8767
set LUNA_PORT=8767
set LUNA_HOST=0.0.0.0
set PY=C:\Users\Stood\AppData\Local\Programs\Python\Python312\python.exe
:loop
echo [%date% %time%] starting Luna on 8767...
"%PY%" server.py
echo [%date% %time%] server exited - restarting in 2s...
timeout /t 2 /nobreak >nul
goto loop
