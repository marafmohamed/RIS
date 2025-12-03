# RIS Health Check Script for Windows
# PowerShell script to check service health

$ErrorActionPreference = "Continue"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "RIS Health Check" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check container status
Write-Host "Container Status:" -ForegroundColor Cyan
Write-Host "----------------"

$containers = @("ris-mongodb", "ris-backend", "ris-frontend", "ris-nginx")

foreach ($container in $containers) {
    $running = docker ps --format '{{.Names}}' | Select-String -Pattern "^$container$" -Quiet
    if ($running) {
        $health = docker inspect --format='{{.State.Health.Status}}' $container 2>$null
        if ($health -eq "healthy" -or [string]::IsNullOrEmpty($health)) {
            Write-Host "✅ ${container}: Running" -ForegroundColor Green
        } else {
            Write-Host "⚠️  ${container}: Running but unhealthy ($health)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ ${container}: Not running" -ForegroundColor Red
    }
}

Write-Host ""

# Check Docker disk usage
Write-Host "Docker Disk Usage:" -ForegroundColor Cyan
Write-Host "-----------------"
docker system df

Write-Host ""

# Check service endpoints
Write-Host "Service Health Checks:" -ForegroundColor Cyan
Write-Host "--------------------"

# Backend health
try {
    $response = Invoke-WebRequest -Uri "http://localhost/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ Backend API: Accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend API: Not accessible" -ForegroundColor Red
}

# Frontend health
try {
    $response = Invoke-WebRequest -Uri "http://localhost" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ Frontend: Accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend: Not accessible" -ForegroundColor Red
}

Write-Host ""

# Check MongoDB connection
Write-Host "Database Status:" -ForegroundColor Cyan
Write-Host "---------------"
try {
    $result = docker exec ris-mongodb mongosh --quiet --eval "db.adminCommand('ping')" 2>$null
    Write-Host "✅ MongoDB: Accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ MongoDB: Not accessible" -ForegroundColor Red
}

Write-Host ""

# Check logs for errors
Write-Host "Recent Errors (last 10):" -ForegroundColor Cyan
Write-Host "----------------------"
$errors = docker-compose logs --tail=100 | Select-String -Pattern "error" -CaseSensitive:$false | Select-Object -Last 10
if ($errors) {
    $errors
} else {
    Write-Host "No recent errors found" -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Health Check Complete" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
