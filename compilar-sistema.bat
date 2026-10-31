@echo off
title El Buen Gusto - Compilar sistema
cd /d "%~dp0"
echo ================================================
echo   El Buen Gusto - compilar el sistema
echo   Corre esto solo cuando se cambie el codigo.
echo   El dia normal no hace falta: el sistema
echo   arranca directo con su acceso directo.
echo ================================================
call npm run build
echo.
if errorlevel 1 goto fallo
echo Listo: compilado para produccion.
pause
exit

:fallo
echo La compilacion fallo. Revisa el mensaje de arriba.
pause
