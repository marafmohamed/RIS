# RIS Docker Deployment Script for Windows
# PowerShell script to manage Docker deployment

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "RIS Docker Deployment Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is available
try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not installed. Please install Docker Compose first." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check if .env file exists
if (-Not (Test-Path .env)) {
    Write-Host "📋 Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "⚠️  IMPORTANT: Edit the .env file and update all configuration values!" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Press Enter to open .env file for editing (or Ctrl+C to exit)"
    notepad .env
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Deployment Options" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "1. Start all services"
Write-Host "2. Stop all services"
Write-Host "3. Restart all services"
Write-Host "4. View logs"
Write-Host "5. Build and start (fresh build)"
Write-Host "6. Remove all containers and volumes (DANGER)"
Write-Host "7. Check service status"
Write-Host "8. Exit"
Write-Host ""

$option = Read-Host "Select an option (1-8)"

switch ($option) {
    1 {
        Write-Host "🚀 Starting all services..." -ForegroundColor Cyan
        docker-compose up -d
        Write-Host ""
        Write-Host "✅ Services started successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Service Status:" -ForegroundColor Cyan
        docker-compose ps
        Write-Host ""
        Write-Host "🌐 Access your application at: http://localhost" -ForegroundColor Green
        Write-Host "🔧 Backend API: http://localhost/api" -ForegroundColor Green
        Write-Host "💾 MongoDB: localhost:27017" -ForegroundColor Green
    }
    2 {
        Write-Host "🛑 Stopping all services..." -ForegroundColor Yellow
        docker-compose down
        Write-Host "✅ All services stopped" -ForegroundColor Green
    }
    3 {
        Write-Host "🔄 Restarting all services..." -ForegroundColor Cyan
        docker-compose restart
        Write-Host "✅ All services restarted" -ForegroundColor Green
    }
    4 {
        Write-Host "📋 Viewing logs (Ctrl+C to exit)..." -ForegroundColor Cyan
        docker-compose logs -f
    }
    5 {
        Write-Host "🔨 Building and starting services..." -ForegroundColor Cyan
        docker-compose up -d --build
        Write-Host "✅ Services built and started" -ForegroundColor Green
        Write-Host ""
        docker-compose ps
    }
    6 {
        Write-Host "⚠️  WARNING: This will remove all containers and volumes!" -ForegroundColor Red
        $confirm = Read-Host "Are you sure? (yes/no)"
        if ($confirm -eq "yes") {
            Write-Host "🗑️  Removing all containers and volumes..." -ForegroundColor Red
            docker-compose down -v
            Write-Host "✅ All containers and volumes removed" -ForegroundColor Green
        } else {
            Write-Host "❌ Operation cancelled" -ForegroundColor Yellow
        }
    }
    7 {
        Write-Host "📊 Service Status:" -ForegroundColor Cyan
        docker-compose ps
        Write-Host ""
        Write-Host "💾 Docker Volumes:" -ForegroundColor Cyan
        docker volume ls | Select-String "ris"
        Write-Host ""
        Write-Host "🌐 Docker Networks:" -ForegroundColor Cyan
        docker network ls | Select-String "ris"
    }
    8 {
        Write-Host "👋 Exiting..." -ForegroundColor Cyan
        exit 0
    }
    default {
        Write-Host "❌ Invalid option" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Useful Commands:" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "View logs: docker-compose logs -f [service_name]"
Write-Host "Restart service: docker-compose restart [service_name]"
Write-Host "Access MongoDB: docker exec -it ris-mongodb mongosh -u risadmin -p"
Write-Host "Access backend shell: docker exec -it ris-backend sh"
Write-Host "==================================" -ForegroundColor Cyan
