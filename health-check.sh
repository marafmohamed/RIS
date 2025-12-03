#!/bin/bash

# Health Check Script for RIS Docker Deployment
# Run this script to check the health of all services

echo "=================================="
echo "RIS Health Check"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Check if containers are running
echo "Container Status:"
echo "----------------"

containers=("ris-mongodb" "ris-backend" "ris-frontend" "ris-nginx")

for container in "${containers[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        status=$(docker inspect --format='{{.State.Health.Status}}' $container 2>/dev/null)
        if [ "$status" = "healthy" ] || [ "$status" = "" ]; then
            echo -e "${GREEN}✅ $container: Running${NC}"
        else
            echo -e "${YELLOW}⚠️  $container: Running but unhealthy ($status)${NC}"
        fi
    else
        echo -e "${RED}❌ $container: Not running${NC}"
    fi
done

echo ""

# Check disk usage
echo "Disk Usage:"
echo "----------"
df -h / | tail -n 1 | awk '{print "Root: " $5 " used (" $3 " / " $2 ")"}'
echo ""

# Check Docker disk usage
echo "Docker Disk Usage:"
echo "-----------------"
docker system df
echo ""

# Check service endpoints
echo "Service Health Checks:"
echo "--------------------"

# Backend health
if curl -s http://localhost/health > /dev/null; then
    echo -e "${GREEN}✅ Backend API: Accessible${NC}"
else
    echo -e "${RED}❌ Backend API: Not accessible${NC}"
fi

# Frontend health
if curl -s http://localhost > /dev/null; then
    echo -e "${GREEN}✅ Frontend: Accessible${NC}"
else
    echo -e "${RED}❌ Frontend: Not accessible${NC}"
fi

echo ""

# Check MongoDB connection
echo "Database Status:"
echo "---------------"
if docker exec ris-mongodb mongosh --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MongoDB: Accessible${NC}"
    
    # Get database stats
    dbSize=$(docker exec ris-mongodb mongosh --quiet --eval "db.stats().dataSize" ris_db 2>/dev/null)
    if [ ! -z "$dbSize" ]; then
        echo "Database size: $(numfmt --to=iec $dbSize 2>/dev/null || echo $dbSize)"
    fi
else
    echo -e "${RED}❌ MongoDB: Not accessible${NC}"
fi

echo ""

# Check logs for errors
echo "Recent Errors (last 10):"
echo "----------------------"
docker-compose logs --tail=100 | grep -i "error" | tail -n 10 || echo "No recent errors found"

echo ""
echo "=================================="
echo "Health Check Complete"
echo "=================================="
