@echo off
title El Buen Gusto - Sistema
cd /d "%~dp0"
echo ================================================
echo   El Buen Gusto - sistema del punto de venta
echo   Abre http://localhost:3000
echo   /o/ la IP del PC desde los telefonos/
echo   Para detener: cierra esta ventana o Ctrl+C
echo ================================================

rem Modo produccion: pantalla limpia, sin el boton de
rem Next devtools que tapaba el boton de Cerrar sesion.
echo Revisando compilacion...
if not exist ".next-prod\BUILD_ID" (
  echo   Primera vez: compilando el sistema. 1-2 minutos.
  call npm run build
  if errorlevel 1 goto compilacion-fallo
)

call npm run start
echo.
echo El sistema se detuvo.
echo - Si el error menciona el puerto 3000: otra ventana ya lo usa.
echo - Si el error habla de BUILD o .next: corre compilar-sistema.bat
pause
exit

:compilacion-fallo
echo.
echo La compilacion fallo. Revisa el mensaje de arriba.
pause
