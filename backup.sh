#!/bin/bash

# Automated Backup Script for RIS Docker Deployment
# This script backs up MongoDB database and application files

set -e

# Configuration
BACKUP_DIR="/opt/backups/ris"
DATE=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=7

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "=================================="
echo "RIS Backup Script"
echo "Date: $(date)"
echo "=================================="
echo ""

# Create backup directory
mkdir -p $BACKUP_DIR

# MongoDB Backup
echo "📦 Backing up MongoDB..."
MONGO_BACKUP_DIR="$BACKUP_DIR/mongodb-$DATE"

docker exec ris-mongodb mongodump \
  --username=${MONGO_ROOT_USER} \
  --password=${MONGO_ROOT_PASSWORD} \
  --authenticationDatabase=admin \
  --db=${MONGO_DATABASE} \
  --out=/data/backup

docker cp ris-mongodb:/data/backup/${MONGO_DATABASE} $MONGO_BACKUP_DIR

if [ -d "$MONGO_BACKUP_DIR" ]; then
    echo "✅ MongoDB backup created: $MONGO_BACKUP_DIR"
    
    # Compress backup
    tar -czf "${MONGO_BACKUP_DIR}.tar.gz" -C "$BACKUP_DIR" "mongodb-$DATE"
    rm -rf "$MONGO_BACKUP_DIR"
    echo "✅ Backup compressed: ${MONGO_BACKUP_DIR}.tar.gz"
else
    echo "❌ MongoDB backup failed"
    exit 1
fi

# Backup environment file (without sensitive data)
echo ""
echo "📦 Backing up configuration..."
cp .env.example "$BACKUP_DIR/env-example-$DATE.txt"

# Clean old backups
echo ""
echo "🧹 Cleaning old backups (older than $RETENTION_DAYS days)..."
find $BACKUP_DIR -name "mongodb-*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "env-example-*.txt" -type f -mtime +$RETENTION_DAYS -delete

# Backup summary
echo ""
echo "=================================="
echo "Backup Summary"
echo "=================================="
echo "Backup location: $BACKUP_DIR"
echo "Backup size: $(du -sh ${MONGO_BACKUP_DIR}.tar.gz | cut -f1)"
echo "Total backups: $(ls -1 $BACKUP_DIR/mongodb-*.tar.gz 2>/dev/null | wc -l)"
echo ""
echo "✅ Backup completed successfully!"
echo "=================================="

# Optional: Upload to remote storage (uncomment and configure)
# echo "☁️  Uploading to remote storage..."
# aws s3 cp "${MONGO_BACKUP_DIR}.tar.gz" s3://your-bucket/backups/
# rclone copy "${MONGO_BACKUP_DIR}.tar.gz" remote:backups/
