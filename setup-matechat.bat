@echo off
setlocal enabledelayedexpansion

echo === MateChat - Configuración inicial ===
echo.
echo Buscando Google Chrome en Windows...

set "CHROME_PATH="

:: Verificar ubicaciones comunes de Chrome
for %%A in (
    "C:\Program Files\Google\Chrome\Application\chrome.exe"
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    "%USERPROFILE%\AppData\Local\Google\Chrome\Application\chrome.exe"
) do (
    if exist "%%~A" (
        set "CHROME_PATH=%%~A"
        echo Chrome encontrado en: %%A
        goto FOUND
    )
)

:FOUND
if "%CHROME_PATH%"=="" (
    echo ❌ Chrome no encontrado. Asegúrate de que está instalado.
    exit /b 1
)

:: Guardar la ruta en chrome-config.js con formato adecuado para JavaScript
echo module.exports = { > chrome-config.js
echo   chromePath: "%CHROME_PATH%", >> chrome-config.js
echo   detected: "%DATE%" >> chrome-config.js
echo }; >> chrome-config.js

echo ✅ Configuración guardada en chrome-config.js
echo.
echo === Iniciando MateChat ===
echo.
echo Instalando dependencias...
call npm install
echo.
echo Iniciando servidor...
echo.
echo IMPORTANTE: Para que funcione correctamente:
echo 1. Escanea el código QR con tu teléfono cuando aparezca
echo 2. Se abrirá una ventana de Chrome para la autenticación
echo 3. No cierres esa ventana durante el uso de MateChat
echo.
echo Presiona cualquier tecla para continuar...
pause > nul

node server.js
exit /b 0