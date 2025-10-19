#!/bin/bash

# Reachinbox Email Aggregator Startup Script

echo "🚀 Starting Reachinbox Email Aggregator..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo " .env file not found. Copying from env.example..."
    cp env.example .env
    echo "
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Elasticsearch is already running
if curl -s http://localhost:9200 > /dev/null 2>&1; then
    echo "Elasticsearch is already running"
else
    echo " Starting Elasticsearch and Kibana..."
    docker-compose up -d elasticsearch kibana
    
    # Wait for Elasticsearch to be ready
    echo " Waiting for Elasticsearch to be ready..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -s http://localhost:9200 > /dev/null 2>&1; then
            echo "Elasticsearch is ready!"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        echo "Elasticsearch failed to start within 60 seconds"
        exit 1
    fi
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Create logs directory
mkdir -p logs

# Start the application
echo "Starting Reachinbox application..."
npm start
