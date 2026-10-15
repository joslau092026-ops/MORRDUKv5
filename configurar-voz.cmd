@echo off
title MORDUK - Voz ElevenLabs
chcp 65001 >nul
echo ============================================
echo   MORDUK - Voz premium (ElevenLabs)
echo ============================================
echo.
echo Necesitas dos datos de tu cuenta en elevenlabs.io:
echo  1. API KEY  - Perfil (icono) - API Keys - copia tu clave (sk_...)
echo  2. VOICE ID - Voices - encuentra la voz (p. ej. "Jhonatan - narrator")
echo               - y copia su ID (texto tipo: abc123XYZ...)
echo.
echo La clave se guarda SOLO en data\elevenlabs.json (fuera del repositorio).
echo.
set /p APIKEY=  Pega tu API KEY y presiona Enter: 
set /p VOICEID=  Pega el VOICE ID y presiona Enter: 

if "%APIKEY%"=="" goto :error
if "%VOICEID%"=="" goto :error

powershell -NoProfile -Command "$d = @{ apiKey = '%APIKEY%'; voiceId = '%VOICEID%' }; New-Item -ItemType Directory -Force -Path '%~dp0data' | Out-Null; $d | ConvertTo-Json | Set-Content -Path '%~dp0data\elevenlabs.json' -Encoding UTF8"
if errorlevel 1 goto :error

echo.
echo   Voz configurada. Reinicia MORDUK y hablara con esa voz.
echo   (Si la voz no suena, verifica que tu cuenta tenga caracteres disponibles.)
echo.
pause
exit /b 0

:error
echo.
echo   Faltaron datos o hubo un error. Nada fue guardado.
pause
exit /b 1