@echo off
REM Reachinbox Email Aggregator Startup Script for Windows

echo Starting Reachinbox Email Aggregator...

REM Check if .env file exists
if not exist .env (
    echo .env file not found. Copying from env.example...
    copy env.example .env
    echo Please edit .env file with your configuration before running again.
    pause
    exit /b 1
)

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker is not running. Please start Docker and try again.
    pause
    exit /b 1
)

REM Check if Elasticsearch is already running
curl -s http://localhost:9200 >nul 2>&1
if not errorlevel 1 (
    echo Elasticsearch is already running
) else (
    echo Starting Elasticsearch and Kibana...
    docker-compose up -d elasticsearch kibana
    
    REM Wait for Elasticsearch to be ready
    echo Waiting for Elasticsearch to be ready...
    set timeout=60
    :wait_loop
    curl -s http://localhost:9200 >nul 2>&1
    if not errorlevel 1 (
        echo Elasticsearch is ready!
        goto :ready
    )
    timeout /t 2 /nobreak >nul
    set /a timeout-=2
    if %timeout% leq 0 (
        echo Elasticsearch failed to start within 60 seconds
        pause
        exit /b 1
    )
    goto :wait_loop
)

:ready

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo Installing dependencies...
    npm install
)

REM Create logs directory
if not exist logs mkdir logs

REM Start the application
echo Starting Reachinbox application...
npm start

pause
