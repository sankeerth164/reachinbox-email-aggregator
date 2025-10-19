@echo off
echo Reachinbox System Test
echo ========================

echo.
echo Checking prerequisites...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo = Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)
echo Node.js is installed

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo npm is not installed. Please install npm first.
    pause
    exit /b 1
)
echo npm is installed

echo.
echo Installing dependencies...
npm install

echo.
echo Starting system test...
node test-system.js

echo.
echo Test completed!
pause
