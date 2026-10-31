@echo off
title El Buen Gusto - Sistema
cd /d "%~dp0"
echo ================================================
echo   El Buen Gusto - sistema del punto de venta
echo   Abre http://localhost:3000
echo   (o la IP del PC desde los telefonos)
echo   Para detener: cierra esta ventana o Ctrl+C
echo ================================================
echo.
echo Compilando el sistema...
call npm run build
if errorlevel 1 goto fallo
echo Listo. Iniciando el servidor...
call npm run dev
echo.
echo El sistema se detuvo.
echo Si el error menciona el puerto 3000: otra ventana ya lo esta usando.
pause
exit

:fallo
echo.
echo La compilacion fallo. Revisa el mensaje de arriba.
pause
