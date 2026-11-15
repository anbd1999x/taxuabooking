@echo off
rem Tunnel DB production: localhost:15432 -> VPS:5432 (giu cua so nay mo khi dev)

rem Cong 15432 da co tunnel chay roi (vd do Claude Code mo) => khong mo them, chi bao va giu cua so.
netstat -ano | findstr /R /C:"127.0.0.1:15432 .*LISTENING" >nul
if %errorlevel%==0 (
  echo Tunnel DB DA CHAY SAN tren cong 15432 - ket noi luon toi 127.0.0.1:15432, khong can mo them.
  pause
  exit /b 0
)

echo Dang mo tunnel DB production (Ctrl+C de dong)...
ssh -i %USERPROFILE%\.ssh\taxua_deploy -N -L 15432:localhost:5432 -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 root@160.187.240.245
echo.
echo Tunnel da dong hoac khong mo duoc (xem loi phia tren).
pause
