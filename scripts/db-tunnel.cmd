@echo off
rem Tunnel DB production: localhost:15432 -> VPS:5432 (giu cua so nay mo khi dev)
echo Dang mo tunnel DB production (Ctrl+C de dong)...
ssh -i %USERPROFILE%\.ssh\taxua_deploy -N -L 15432:localhost:5432 -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 root@160.187.240.245
