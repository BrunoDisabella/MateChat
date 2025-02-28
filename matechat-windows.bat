@echo off
setlocal enabledelayedexpansion

echo ===================================
echo     MateChat - WhatsApp Integration
echo ===================================
echo.

:: Verificar si Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js no está instalado.
    echo Por favor, instala Node.js desde https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Verificar dependencias
echo Verificando dependencias...
if not exist node_modules (
    echo Instalando dependencias (puede tardar unos minutos)...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: No se pudieron instalar las dependencias.
        pause
        exit /b 1
    )
)

:: Verificar configuración de Chrome
echo Buscando Google Chrome...

set "CHROME_PATH="

:: Verificar ubicaciones comunes de Chrome
for %%A in (
    "C:\Program Files\Google\Chrome\Application\chrome.exe"
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    "%USERPROFILE%\AppData\Local\Google\Chrome\Application\chrome.exe"
) do (
    if exist "%%~A" (
        set "CHROME_PATH=%%~A"
        echo Chrome encontrado en: "%%~A"
        goto FOUND
    )
)

echo Chrome no encontrado en ubicaciones estándar.
echo Buscando en el sistema...

for /f "tokens=*" %%i in ('where /r "C:\Program Files" chrome.exe 2^>nul') do (
    set "CHROME_PATH=%%i"
    echo Chrome encontrado en: "%%i"
    goto FOUND
)

for /f "tokens=*" %%i in ('where /r "C:\Program Files (x86)" chrome.exe 2^>nul') do (
    set "CHROME_PATH=%%i"
    echo Chrome encontrado en: "%%i"
    goto FOUND
)

:FOUND
if "!CHROME_PATH!"=="" (
    echo ❌ Chrome no encontrado. Asegúrate de que está instalado.
    pause
    exit /b 1
)

:: Crear el archivo de configuración con la ruta correcta y con escapes adecuados
set "ESCAPED_PATH=!CHROME_PATH:\=\\!"
echo module.exports = { > chrome-config.js
echo   chromePath: "!ESCAPED_PATH!", >> chrome-config.js
echo   detected: "%DATE%" >> chrome-config.js
echo }; >> chrome-config.js

echo ✅ Configuración guardada en chrome-config.js
echo.
echo === Iniciando MateChat ===
echo.
echo IMPORTANTE: Para que funcione correctamente:
echo 1. Se abrirá una ventana de Chrome para WhatsApp Web
echo 2. Visita http://localhost:3000 en tu navegador
echo 3. Escanea el código QR cuando aparezca
echo 4. No cierres la ventana de Chrome durante el uso de MateChat
echo.
echo Presiona cualquier tecla para iniciar...
pause > nul

node server.js