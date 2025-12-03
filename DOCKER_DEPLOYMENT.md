# 🐳 RIS Docker Deployment Guide

Complete guide for deploying the Radiology Information System (RIS) on a VPS using Docker.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Quick Start](#quick-start)
4. [Detailed Setup](#detailed-setup)
5. [SSL/HTTPS Configuration](#ssl-https-configuration)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Troubleshooting](#troubleshooting)
8. [Backup and Recovery](#backup-and-recovery)

## Prerequisites

### VPS Requirements
- **OS**: Ubuntu 20.04+ or similar Linux distribution
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: 50GB minimum (100GB+ recommended for medical images)
- **CPU**: 2 cores minimum (4 cores recommended)

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git

## Architecture Overview

The application consists of 4 main containers:

```
┌─────────────────────────────────────────────┐
│              Nginx (Port 80/443)            │
│         Reverse Proxy & Load Balancer       │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌──────▼────────┐
│   Frontend     │  │   Backend     │
│   (Next.js)    │  │   (Express)   │
│   Port 3000    │  │   Port 5000   │
└────────────────┘  └───────┬───────┘
                            │
                    ┌───────▼────────┐
                    │    MongoDB     │
                    │   Port 27017   │
                    └────────────────┘
```

### Containers:
1. **nginx**: Reverse proxy, SSL termination, static file serving
2. **frontend**: Next.js application
3. **backend**: Express.js API server
4. **mongodb**: Database with persistent volumes

## Quick Start

### 1. Clone and Configure

```bash
# On your VPS
cd /opt
git clone https://github.com/yourusername/RIS.git
cd RIS

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### 2. Update .env File

```bash
# MongoDB Configuration
MONGO_ROOT_USER=risadmin
MONGO_ROOT_PASSWORD=YOUR_SECURE_PASSWORD_HERE
MONGO_DATABASE=ris_db

# Backend Configuration
JWT_SECRET=YOUR_VERY_LONG_RANDOM_SECRET_KEY_MIN_64_CHARACTERS
FRONTEND_URL=http://YOUR_VPS_IP_OR_DOMAIN

# Orthanc PACS Configuration
ORTHANC_URL=http://YOUR_ORTHANC_SERVER:8042
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD=orthanc

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://YOUR_VPS_IP_OR_DOMAIN/api
NEXT_PUBLIC_ORTHANC_URL=http://YOUR_ORTHANC_SERVER:8042
```

### 3. Deploy

**On Linux:**
```bash
chmod +x deploy.sh
./deploy.sh
```

**On Windows:**
```powershell
.\deploy.ps1
```

Or manually:
```bash
docker-compose up -d --build
```

### 4. Verify Deployment

```bash
# Check all containers are running
docker-compose ps

# Check logs
docker-compose logs -f

# Test the application
curl http://localhost/health
```

Access your application at: `http://YOUR_VPS_IP`

## Detailed Setup

### Step 1: VPS Initial Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group (optional)
sudo usermod -aG docker $USER
newgrp docker

# Verify installations
docker --version
docker-compose --version
```

### Step 2: Firewall Configuration

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH (important - don't lock yourself out!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check firewall status
sudo ufw status
```

### Step 3: Directory Structure Setup

```bash
# Create application directory
sudo mkdir -p /opt/RIS
sudo chown $USER:$USER /opt/RIS
cd /opt/RIS

# Clone your repository
git clone https://github.com/yourusername/RIS.git .

# Create required directories
mkdir -p nginx/ssl
mkdir -p backend/logs
```

### Step 4: Generate Strong Secrets

```bash
# Generate JWT secret (64+ characters)
openssl rand -base64 64

# Generate MongoDB password
openssl rand -base64 32
```

Copy these values into your `.env` file.

### Step 5: Build and Start Services

```bash
# Build images
docker-compose build

# Start services in detached mode
docker-compose up -d

# Monitor logs
docker-compose logs -f
```

## SSL/HTTPS Configuration

### Using Let's Encrypt (Recommended)

#### 1. Install Certbot

```bash
sudo apt install certbot
```

#### 2. Stop Nginx temporarily

```bash
docker-compose stop nginx
```

#### 3. Generate SSL Certificate

```bash
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

#### 4. Copy Certificates

```bash
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/
sudo chown $USER:$USER nginx/ssl/*.pem
```

#### 5. Update Nginx Configuration

Edit `nginx/conf.d/ris.conf`:

1. Comment out the HTTP server block
2. Uncomment the HTTPS server block
3. Update `server_name` with your domain

```bash
nano nginx/conf.d/ris.conf
```

#### 6. Restart Nginx

```bash
docker-compose up -d nginx
```

#### 7. Setup Auto-Renewal

```bash
# Create renewal script
sudo nano /etc/cron.monthly/renew-ssl.sh
```

Add:
```bash
#!/bin/bash
docker-compose -f /opt/RIS/docker-compose.yml stop nginx
certbot renew
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/RIS/nginx/ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/RIS/nginx/ssl/
docker-compose -f /opt/RIS/docker-compose.yml start nginx
```

```bash
sudo chmod +x /etc/cron.monthly/renew-ssl.sh
```

### Using Self-Signed Certificate (Development)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=yourdomain.com"
```

## Monitoring and Maintenance

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
docker-compose logs -f nginx

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Check Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df

# Detailed volume info
docker volume ls
docker volume inspect ris_mongodb_data
```

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose up -d --build

# Or restart specific service
docker-compose up -d --build backend
```

### Database Backup

```bash
# Create backup directory
mkdir -p /opt/backups

# Backup MongoDB
docker exec ris-mongodb mongodump \
  --username=risadmin \
  --password=YOUR_PASSWORD \
  --authenticationDatabase=admin \
  --db=ris_db \
  --out=/data/backup

# Copy backup to host
docker cp ris-mongodb:/data/backup /opt/backups/mongodb-$(date +%Y%m%d-%H%M%S)
```

### Automate Backups

```bash
# Create backup script
sudo nano /opt/RIS/backup.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d-%H%M%S)

# MongoDB backup
docker exec ris-mongodb mongodump \
  --username=risadmin \
  --password=YOUR_PASSWORD \
  --authenticationDatabase=admin \
  --db=ris_db \
  --out=/data/backup

docker cp ris-mongodb:/data/backup $BACKUP_DIR/mongodb-$DATE

# Keep only last 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /opt/RIS/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
```

Add:
```
0 2 * * * /opt/RIS/backup.sh >> /var/log/ris-backup.log 2>&1
```

### Restore from Backup

```bash
# Copy backup to container
docker cp /opt/backups/mongodb-TIMESTAMP/ris_db ris-mongodb:/data/restore

# Restore
docker exec ris-mongodb mongorestore \
  --username=risadmin \
  --password=YOUR_PASSWORD \
  --authenticationDatabase=admin \
  --db=ris_db \
  /data/restore/ris_db
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs [service_name]

# Check container status
docker-compose ps

# Restart service
docker-compose restart [service_name]
```

### Database Connection Issues

```bash
# Access MongoDB shell
docker exec -it ris-mongodb mongosh -u risadmin -p

# Check connection from backend
docker exec -it ris-backend sh
# Inside container:
nc -zv mongodb 27017
```

### Nginx Issues

```bash
# Test configuration
docker exec ris-nginx nginx -t

# Reload nginx
docker exec ris-nginx nginx -s reload

# Check error logs
docker exec ris-nginx cat /var/log/nginx/error.log
```

### Port Already in Use

```bash
# Find process using port 80
sudo lsof -i :80

# Kill process
sudo kill -9 [PID]

# Or change port in docker-compose.yml
```

### Out of Disk Space

```bash
# Clean up Docker
docker system prune -a

# Remove unused volumes
docker volume prune

# Check disk usage
df -h
du -sh /var/lib/docker
```

### Performance Issues

```bash
# Increase resources in docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G

# Restart with new limits
docker-compose up -d
```

## Useful Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart backend

# View logs
docker-compose logs -f

# Execute command in container
docker exec -it ris-backend sh

# Access MongoDB
docker exec -it ris-mongodb mongosh -u risadmin -p

# Check service health
docker-compose ps

# Rebuild specific service
docker-compose up -d --build backend

# Scale service (if needed)
docker-compose up -d --scale backend=2

# Remove everything (including volumes)
docker-compose down -v
```

## Security Best Practices

1. **Change Default Passwords**: Update all passwords in `.env`
2. **Use Strong Secrets**: Generate cryptographically secure keys
3. **Enable Firewall**: Only allow necessary ports
4. **Use HTTPS**: Always use SSL in production
5. **Regular Updates**: Keep Docker and images updated
6. **Backup Regularly**: Automate database backups
7. **Monitor Logs**: Check for suspicious activity
8. **Restrict MongoDB Access**: Don't expose port 27017 publicly
9. **Use Private Networks**: Keep services on internal Docker network
10. **Environment Variables**: Never commit `.env` to Git

## Production Checklist

- [ ] VPS with adequate resources
- [ ] Docker and Docker Compose installed
- [ ] Firewall configured
- [ ] .env file with secure passwords
- [ ] SSL certificate installed
- [ ] Nginx configured for HTTPS
- [ ] Database backup automated
- [ ] Monitoring set up
- [ ] Domain name configured
- [ ] DNS records updated
- [ ] Test all functionality
- [ ] Default admin password changed

## Support

For issues and questions:
- Check logs: `docker-compose logs -f`
- Review documentation in `/docs`
- Check container health: `docker-compose ps`

## License

MIT License - See LICENSE file for details
