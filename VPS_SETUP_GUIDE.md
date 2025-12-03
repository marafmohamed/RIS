# 🚀 Complete VPS Setup Guide

Step-by-step guide to deploy RIS on your VPS from scratch.

## Prerequisites

- VPS with Ubuntu 20.04+ (minimum 4GB RAM, 2 CPU cores, 50GB storage)
- Root or sudo access
- Domain name (optional, but recommended for SSL)

## Step 1: Initial VPS Setup

### 1.1 Connect to VPS

```bash
ssh root@YOUR_VPS_IP
```

### 1.2 Update System

```bash
apt update && apt upgrade -y
```

### 1.3 Create Non-Root User (Optional but Recommended)

```bash
adduser risadmin
usermod -aG sudo risadmin
su - risadmin
```

### 1.4 Configure Firewall

```bash
# Enable firewall
sudo ufw enable

# Allow SSH (IMPORTANT - don't lock yourself out!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

## Step 2: Install Docker

### 2.1 Install Docker Engine

```bash
# Install prerequisites
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index
sudo apt update

# Install Docker
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Verify installation
docker --version
```

### 2.2 Install Docker Compose

```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make it executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

### 2.3 Add User to Docker Group (Optional)

```bash
sudo usermod -aG docker $USER
newgrp docker

# Test Docker without sudo
docker ps
```

## Step 3: Install Git

```bash
sudo apt install -y git
git --version
```

## Step 4: Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/RIS
sudo chown $USER:$USER /opt/RIS
cd /opt/RIS

# Clone repository
git clone https://github.com/YOUR_USERNAME/RIS.git .

# Or upload files via SCP from your local machine:
# scp -r /local/path/to/RIS/* user@YOUR_VPS_IP:/opt/RIS/
```

## Step 5: Configure Environment

### 5.1 Copy Environment Template

```bash
cd /opt/RIS
cp .env.example .env
```

### 5.2 Generate Secure Secrets

```bash
# Generate JWT secret (copy the output)
openssl rand -base64 64

# Generate MongoDB password (copy the output)
openssl rand -base64 32
```

### 5.3 Edit .env File

```bash
nano .env
```

Update these values:

```bash
# MongoDB Configuration
MONGO_ROOT_USER=risadmin
MONGO_ROOT_PASSWORD=<PASTE_GENERATED_PASSWORD_HERE>
MONGO_DATABASE=ris_db

# Backend Configuration
JWT_SECRET=<PASTE_GENERATED_JWT_SECRET_HERE>
FRONTEND_URL=http://YOUR_VPS_IP  # or http://yourdomain.com

# Orthanc PACS Configuration
ORTHANC_URL=http://YOUR_ORTHANC_SERVER:8042
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD=orthanc

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://YOUR_VPS_IP/api  # or http://yourdomain.com/api
NEXT_PUBLIC_ORTHANC_URL=http://YOUR_ORTHANC_SERVER:8042
```

Save and exit (Ctrl+X, then Y, then Enter)

## Step 6: Deploy Application

### 6.1 Make Scripts Executable

```bash
chmod +x deploy.sh backup.sh health-check.sh
```

### 6.2 Start Deployment

```bash
./deploy.sh
```

Or manually:

```bash
# Build and start all services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 6.3 Wait for Services to Start

This may take 5-10 minutes for the first build.

### 6.4 Verify Deployment

```bash
# Run health check
./health-check.sh

# Or check manually
curl http://localhost/health
curl http://localhost/api/health
```

## Step 7: Access Application

Open your browser and navigate to:
- `http://YOUR_VPS_IP` - Frontend
- `http://YOUR_VPS_IP/api` - Backend API

Default login credentials:
- Email: `admin@ris.com`
- Password: `admin123`

**⚠️ IMPORTANT: Change the default password immediately after first login!**

## Step 8: Setup SSL (Recommended for Production)

### 8.1 Point Domain to VPS

Update your domain's DNS A record to point to your VPS IP address.

Wait for DNS propagation (can take up to 48 hours, usually much faster).

### 8.2 Install Certbot

```bash
sudo apt install -y certbot
```

### 8.3 Stop Nginx Temporarily

```bash
docker-compose stop nginx
```

### 8.4 Generate SSL Certificate

```bash
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts. Certbot will generate certificates in `/etc/letsencrypt/live/yourdomain.com/`

### 8.5 Copy Certificates to Docker Volume

```bash
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/RIS/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/RIS/nginx/ssl/
sudo chown $USER:$USER /opt/RIS/nginx/ssl/*.pem
```

### 8.6 Update Nginx Configuration

```bash
nano nginx/conf.d/ris.conf
```

1. Comment out the HTTP server block (lines for port 80)
2. Uncomment the HTTPS server block (lines for port 443)
3. Update `server_name` with your domain

### 8.7 Update Environment Variables

```bash
nano .env
```

Update URLs to use HTTPS:

```bash
FRONTEND_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
```

### 8.8 Restart Services

```bash
docker-compose down
docker-compose up -d --build
```

### 8.9 Setup Auto-Renewal

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

Make it executable:

```bash
sudo chmod +x /etc/cron.monthly/renew-ssl.sh
```

## Step 9: Setup Automated Backups

### 9.1 Test Backup Script

```bash
./backup.sh
```

### 9.2 Schedule Daily Backups

```bash
crontab -e
```

Add this line (runs daily at 2 AM):

```
0 2 * * * /opt/RIS/backup.sh >> /var/log/ris-backup.log 2>&1
```

### 9.3 Verify Cron Job

```bash
crontab -l
```

## Step 10: Monitoring and Maintenance

### 10.1 View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
docker-compose logs -f nginx
```

### 10.2 Check Resource Usage

```bash
# Container stats
docker stats

# Disk usage
df -h
docker system df
```

### 10.3 Update Application

```bash
cd /opt/RIS
git pull
docker-compose up -d --build
```

## Troubleshooting

### Can't Access Application

```bash
# Check if containers are running
docker-compose ps

# Check logs for errors
docker-compose logs

# Check firewall
sudo ufw status

# Test locally
curl http://localhost
```

### Container Keeps Restarting

```bash
# Check container logs
docker-compose logs <service_name>

# Check resource usage
docker stats

# Restart specific service
docker-compose restart <service_name>
```

### Database Connection Issues

```bash
# Check MongoDB logs
docker-compose logs mongodb

# Access MongoDB shell
docker exec -it ris-mongodb mongosh -u risadmin -p

# Verify environment variables
docker-compose config
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a
docker volume prune

# Check log files
sudo du -sh /var/log/*
sudo journalctl --vacuum-time=3d
```

## Security Checklist

- [ ] Firewall configured (UFW)
- [ ] SSH key authentication enabled (password auth disabled)
- [ ] Strong passwords for MongoDB and admin user
- [ ] SSL/HTTPS enabled
- [ ] Regular backups scheduled
- [ ] MongoDB not exposed to internet (only accessible via Docker network)
- [ ] Environment variables secured (not in Git)
- [ ] System and Docker images regularly updated
- [ ] Fail2ban installed (optional but recommended)
- [ ] Monitoring setup

## Optional: Install Fail2ban (Brute Force Protection)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## Optional: Setup System Monitoring

```bash
# Install htop
sudo apt install -y htop

# Monitor system
htop

# Monitor Docker
docker stats
```

## Useful Commands Reference

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart backend

# View logs
docker-compose logs -f

# Access MongoDB shell
docker exec -it ris-mongodb mongosh -u risadmin -p

# Access backend shell
docker exec -it ris-backend sh

# Backup database
./backup.sh

# Health check
./health-check.sh

# Update application
git pull && docker-compose up -d --build
```

## Support

If you encounter issues:
1. Check logs: `docker-compose logs -f`
2. Run health check: `./health-check.sh`
3. Check Docker documentation
4. Review TROUBLESHOOTING.md

## Next Steps

1. Change default admin password
2. Create additional user accounts
3. Configure Orthanc PACS connection
4. Test all functionality
5. Setup monitoring and alerts
6. Document any customizations

---

**Congratulations! Your RIS application is now deployed on your VPS!** 🎉
