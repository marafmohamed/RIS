# Docker Quick Reference

## 🚀 Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit configuration
nano .env

# 3. Start services
docker-compose up -d --build

# 4. Check status
docker-compose ps
```

## 📦 Services

- **Frontend**: http://localhost (Next.js)
- **Backend API**: http://localhost/api (Express)
- **MongoDB**: localhost:27017
- **Nginx**: Port 80 (HTTP), 443 (HTTPS)

## 🛠️ Common Commands

### Start/Stop
```bash
docker-compose up -d              # Start all services
docker-compose down               # Stop all services
docker-compose restart            # Restart all services
docker-compose restart backend    # Restart specific service
```

### Logs
```bash
docker-compose logs -f            # All logs
docker-compose logs -f backend    # Backend logs only
docker-compose logs --tail=50     # Last 50 lines
```

### Build
```bash
docker-compose build              # Build all images
docker-compose build backend      # Build specific image
docker-compose up -d --build      # Rebuild and start
```

### Database
```bash
# Access MongoDB shell
docker exec -it ris-mongodb mongosh -u risadmin -p

# Backup database
docker exec ris-mongodb mongodump --username=risadmin --password=PASSWORD --authenticationDatabase=admin --db=ris_db --out=/data/backup

# Restore database
docker exec ris-mongodb mongorestore --username=risadmin --password=PASSWORD --authenticationDatabase=admin --db=ris_db /data/restore/ris_db
```

### Maintenance
```bash
# View resource usage
docker stats

# Clean up
docker system prune -a            # Remove unused containers, networks, images
docker volume prune               # Remove unused volumes

# Update application
git pull
docker-compose up -d --build
```

## 🔧 Troubleshooting

### Check Service Health
```bash
docker-compose ps
docker-compose logs [service_name]
```

### Container Won't Start
```bash
docker-compose logs [service_name]
docker-compose restart [service_name]
```

### Reset Everything
```bash
docker-compose down -v            # DANGER: Removes all data
docker-compose up -d --build
```

## 📝 Configuration Files

- `docker-compose.yml` - Service orchestration
- `.env` - Environment variables
- `backend/Dockerfile` - Backend image
- `frontend/Dockerfile` - Frontend image
- `nginx/nginx.conf` - Nginx main config
- `nginx/conf.d/ris.conf` - RIS application config
- `mongo-init.js` - MongoDB initialization

## 📚 Full Documentation

See [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for complete deployment guide.
