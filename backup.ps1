# Automated Backup Script for RIS Docker Deployment (Windows)
# PowerShell script to backup MongoDB database

$ErrorActionPreference = "Stop"

# Configuration
$BACKUP_DIR = "C:\backups\ris"
$DATE = Get-Date -Format "yyyyMMdd-HHmmss"
$RETENTION_DAYS = 7

# Load environment variables
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "RIS Backup Script" -ForegroundColor Cyan
Write-Host "Date: $(Get-Date)" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Create backup directory
New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null

# MongoDB Backup
Write-Host "📦 Backing up MongoDB..." -ForegroundColor Cyan
$MONGO_BACKUP_DIR = "$BACKUP_DIR\mongodb-$DATE"

$MONGO_USER = $env:MONGO_ROOT_USER
$MONGO_PASS = $env:MONGO_ROOT_PASSWORD
$MONGO_DB = $env:MONGO_DATABASE

docker exec ris-mongodb mongodump `
  --username=$MONGO_USER `
  --password=$MONGO_PASS `
  --authenticationDatabase=admin `
  --db=$MONGO_DB `
  --out=/data/backup

docker cp ris-mongodb:/data/backup/$MONGO_DB $MONGO_BACKUP_DIR

if (Test-Path $MONGO_BACKUP_DIR) {
    Write-Host "✅ MongoDB backup created: $MONGO_BACKUP_DIR" -ForegroundColor Green
    
    # Compress backup
    $zipFile = "${MONGO_BACKUP_DIR}.zip"
    Compress-Archive -Path $MONGO_BACKUP_DIR -DestinationPath $zipFile
    Remove-Item -Recurse -Force $MONGO_BACKUP_DIR
    Write-Host "✅ Backup compressed: $zipFile" -ForegroundColor Green
} else {
    Write-Host "❌ MongoDB backup failed" -ForegroundColor Red
    exit 1
}

# Backup environment file
Write-Host ""
Write-Host "📦 Backing up configuration..." -ForegroundColor Cyan
Copy-Item .env.example "$BACKUP_DIR\env-example-$DATE.txt"

# Clean old backups
Write-Host ""
Write-Host "🧹 Cleaning old backups (older than $RETENTION_DAYS days)..." -ForegroundColor Cyan
$cutoffDate = (Get-Date).AddDays(-$RETENTION_DAYS)
Get-ChildItem -Path $BACKUP_DIR -Filter "mongodb-*.zip" | Where-Object { $_.LastWriteTime -lt $cutoffDate } | Remove-Item
Get-ChildItem -Path $BACKUP_DIR -Filter "env-example-*.txt" | Where-Object { $_.LastWriteTime -lt $cutoffDate } | Remove-Item

# Backup summary
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Backup Summary" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Backup location: $BACKUP_DIR"
$backupCount = (Get-ChildItem -Path $BACKUP_DIR -Filter "mongodb-*.zip").Count
Write-Host "Total backups: $backupCount"
Write-Host ""
Write-Host "✅ Backup completed successfully!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
