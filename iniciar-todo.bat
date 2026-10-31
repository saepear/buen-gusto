@echo off
title El Buen Gusto - iniciando todo
cd /d "%~dp0"
rem Abre dos ventanas: sistema en produccion y puente de WhatsApp
start "Buen Gusto - Puente WhatsApp" cmd /k call iniciar-puente.bat
start "Buen Gusto - Sistema" cmd /k call iniciar-sistema.bat
echo Se abrieron las 2 ventanas:
echo   1. Sistema del punto de venta - produccion, pantalla limpia
echo   2. Puente de WhatsApp - el QR sale ahi solo la primera vez
exit
