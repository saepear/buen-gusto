@echo off
title El Buen Gusto - Puente de WhatsApp
cd /d "%~dp0"
echo ================================================
echo   El Buen Gusto - puente de WhatsApp
echo   Si pide QR: WhatsApp del negocio
echo   Ajustes / Dispositivos vinculados / Vincular dispositivo
echo   La sesion queda guardada (solo pide QR 1 vez)
echo   Para detener: cierra esta ventana o Ctrl+C
echo ================================================
call npm run bridge
echo.
echo El puente se detuvo. Si fue un error, revisa el mensaje de arriba.
pause
