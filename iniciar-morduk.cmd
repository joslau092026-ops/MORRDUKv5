@echo off
rem ============================================================
rem  MORDUK - Lanzador con micrófono permitido automáticamente
rem  Abre el Núcleo Panda en Chrome sin preguntar permisos.
rem ============================================================
title MORDUK

cd /d "%~dp0"

rem 1. Arranca el servidor si no está corriendo
netstat -ano | findstr ":8420.*LISTENING" >nul
if errorlevel 1 (
  echo Iniciando servidor MORDUK...
  start "MORDUK servidor" /min node server.js --no-browser
  timeout /t 3 /nobreak >nul
)

rem 1b. Enciende el cerebro Qwen 7B si no está corriendo
netstat -ano | findstr ":1234.*LISTENING" >nul
if errorlevel 1 (
  if exist "tools\iniciar-servidor.ps1" (
    echo Encendiendo cerebro Qwen 7B...
    powershell -NoProfile -ExecutionPolicy Bypass -File "tools\iniciar-servidor.ps1"
  )
)

rem 2. Abre Chrome en modo app con micrófono auto-permitido
set CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" (
  echo Chrome no encontrado. Abre manualmente http://localhost:8420 en Edge o Chrome.
  pause
  exit /b 1
)

start "" "%CHROME%" --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required --user-data-dir="%TEMP%\morduk-chrome-profile" --window-size=1200,800 --app=http://localhost:8420
echo MORDUK activo. Di "MORDUK" antes de cada orden.
timeout /t 3 /nobreak >nul