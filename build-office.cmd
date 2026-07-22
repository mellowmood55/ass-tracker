@echo off
REM Build the web UI for office LAN production (run after git pull / code changes)

cd /d "%~dp0"

echo.
echo Installing dependencies and building apps\web\dist ...
echo.

call npm run build
if errorlevel 1 (
  echo.
  echo [error] Build failed.
  pause
  exit /b 1
)

echo.
echo Build complete. Next: run start-office.cmd
echo.
pause
