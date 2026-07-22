@echo off
echo Starting Imposter game server and Cloudflare tunnel...
echo.
echo Web:   https://imposter.shoplumiere.dpdns.org
echo Local: http://localhost:3000
echo.

REM Start the game server in background
start "Imposter Server" cmd /k "cd /d F:\Apps\imposter-game && npm run dev"

REM Wait for server to be ready
echo Waiting for server to start...
timeout /t 8 /nobreak >nul

REM Start cloudflare tunnel
"C:\Users\santo\AppData\Local\Temp\cloudflared.exe" tunnel run imposter
