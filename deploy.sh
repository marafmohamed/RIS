#!/bin/bash

# RIS Docker Deployment Script
# This script helps you deploy the RIS application using Docker

set -e

echo "=================================="
echo "RIS Docker Deployment Setup"
echo "=================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📋 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Edit the .env file and update all configuration values!"
    echo ""
    read -p "Press Enter to open .env file for editing (or Ctrl+C to exit)..."
    ${EDITOR:-nano} .env
else
    echo "✅ .env file already exists"
fi

echo ""
echo "=================================="
echo "Deployment Options"
echo "=================================="
echo "1. Start all services"
echo "2. Stop all services"
echo "3. Restart all services"
echo "4. View logs"
echo "5. Build and start (fresh build)"
echo "6. Remove all containers and volumes (DANGER)"
echo "7. Check service status"
echo "8. Exit"
echo ""

read -p "Select an option (1-8): " option

case $option in
    1)
        echo "🚀 Starting all services..."
        docker-compose up -d
        echo ""
        echo "✅ Services started successfully!"
        echo ""
        echo "📊 Service Status:"
        docker-compose ps
        echo ""
        echo "🌐 Access your application at: http://localhost"
        echo "🔧 Backend API: http://localhost/api"
        echo "💾 MongoDB: localhost:27017"
        ;;
    2)
        echo "🛑 Stopping all services..."
        docker-compose down
        echo "✅ All services stopped"
        ;;
    3)
        echo "🔄 Restarting all services..."
        docker-compose restart
        echo "✅ All services restarted"
        ;;
    4)
        echo "📋 Viewing logs (Ctrl+C to exit)..."
        docker-compose logs -f
        ;;
    5)
        echo "🔨 Building and starting services..."
        docker-compose up -d --build
        echo "✅ Services built and started"
        echo ""
        docker-compose ps
        ;;
    6)
        echo "⚠️  WARNING: This will remove all containers and volumes!"
        read -p "Are you sure? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo "🗑️  Removing all containers and volumes..."
            docker-compose down -v
            echo "✅ All containers and volumes removed"
        else
            echo "❌ Operation cancelled"
        fi
        ;;
    7)
        echo "📊 Service Status:"
        docker-compose ps
        echo ""
        echo "💾 Docker Volumes:"
        docker volume ls | grep ris
        echo ""
        echo "🌐 Docker Networks:"
        docker network ls | grep ris
        ;;
    8)
        echo "👋 Exiting..."
        exit 0
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "=================================="
echo "Useful Commands:"
echo "=================================="
echo "View logs: docker-compose logs -f [service_name]"
echo "Restart service: docker-compose restart [service_name]"
echo "Access MongoDB: docker exec -it ris-mongodb mongosh -u risadmin -p"
echo "Access backend shell: docker exec -it ris-backend sh"
echo "=================================="
