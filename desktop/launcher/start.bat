@echo off
setlocal
cd /d "%~dp0"
set "PORT=18080"
set "MATH_DESKTOP=1"
set "MATH_PORT=%PORT%"
set "MATH_DB_PATH=%~dp0data\math.db"
set "MATH_WEB_DIR=%~dp0frontend"
if not exist "logs" mkdir "logs"
if not exist "runtime\bin\java.exe" (
  echo Missing runtime\bin\java.exe. Please extract the complete package.
  pause
  exit /b 1
)
curl -fsS http://127.0.0.1:%PORT%/api/health >nul 2>&1
if not errorlevel 1 (
  start "" http://127.0.0.1:%PORT%/
  exit /b 0
)
start "Axiom" /min cmd /c "%~dp0run-server.bat"
for /l %%i in (1,1,40) do (
  curl -fsS http://127.0.0.1:%PORT%/api/health >nul 2>&1 && goto open
  timeout /t 1 /nobreak >nul
)
echo Axiom did not start within 40 seconds. See logs\server.log
pause
exit /b 1
:open
start "" http://127.0.0.1:%PORT%/
exit /b 0
