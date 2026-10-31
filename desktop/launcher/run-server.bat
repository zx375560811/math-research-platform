@echo off
cd /d "%~dp0"
if not exist "logs" mkdir "logs"
if not exist "data" mkdir "data"
if not exist "temp" mkdir "temp"
set "MATH_DESKTOP=1"
set "MATH_PORT=18080"
set "MATH_DB_PATH=%~dp0data\math.db"
set "MATH_WEB_DIR=%~dp0frontend"
"%~dp0runtime\bin\java.exe" -Djava.io.tmpdir="%~dp0temp" -jar "%~dp0app\math-server.jar" >> "%~dp0logs\server.log" 2>&1
