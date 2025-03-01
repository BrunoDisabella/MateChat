@echo off
echo MateChat - Setup Assistant
echo ===========================
echo.
echo This script will help you set up MateChat on your Windows system.
echo.

:: Check if Node.js is installed
WHERE node >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed or not in PATH.
    echo Please install Node.js (version 16 or higher) from https://nodejs.org/
    echo and run this script again.
    pause
    exit /b
)

:: Check Node.js version
FOR /F "tokens=* USEBACKQ" %%F IN (`node -v`) DO SET node_version=%%F
echo Detected Node.js version: %node_version%
echo.

:: Install dependencies
echo Installing dependencies...
call npm install
IF %ERRORLEVEL% NEQ 0 (
    echo Failed to install dependencies.
    pause
    exit /b
)
echo Dependencies installed successfully.
echo.

:: Prompt for MongoDB URI
set /p mongodb_uri=Enter your MongoDB URI (or press Enter to use a local MongoDB): 
if "%mongodb_uri%"=="" set mongodb_uri=mongodb://localhost:27017/matechat

:: Prompt for N8N webhook URL
set /p n8n_webhook=Enter your N8N webhook URL (or press Enter to configure later): 

:: Create .env file
echo Creating .env file...
echo PORT=3000> .env
echo MONGODB_URI=%mongodb_uri%>> .env
if not "%n8n_webhook%"=="" echo N8N_WEBHOOK_URL=%n8n_webhook%>> .env

echo.
echo Setup completed successfully!
echo.
echo To start MateChat, run:
echo    npm start
echo.
echo Or use the matechat-windows.bat file.
echo.
pause