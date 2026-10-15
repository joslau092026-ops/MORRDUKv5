@echo off
title MORDUK - Configurar autoarranque
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0config\setup-autostart.ps1" -Ruta "%~dp0iniciar-morduk.cmd"
pause