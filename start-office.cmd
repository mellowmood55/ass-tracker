@echo off
REM ICT Asset Tracker — office LAN production start
REM Run once after reboot (or via Task Scheduler). Users open http://THIS-PC-IP:4000

cd /d "%~dp0"

if not exist "apps\web\dist\index.html" (
  echo.
  echo [error] Built UI not found. Run build-office.cmd first, then try again.
  echo.
  pause
  exit /b 1
)

if not exist "apps\api\.env" (
  echo.
  echo [error] Missing apps\api\.env — copy from apps\api\.env.example and set DATABASE_URL + JWT_SECRET.
  echo.
  pause
  exit /b 1
)

set NODE_ENV=production
set HOST=0.0.0.0

echo.
echo Starting ICT Asset Tracker (production^)...
echo On this PC:     http://localhost:4000
echo On LAN devices: http://THIS-PC-LAN-IP:4000
echo Press Ctrl+C to stop.
echo.

call npm start
if errorlevel 1 (
  echo.
  echo [error] Server exited with an error.
  pause
  exit /b 1
)
