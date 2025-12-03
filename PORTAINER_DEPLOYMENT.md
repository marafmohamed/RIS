# 🚀 RIS Deployment with Portainer & Nginx Proxy Manager

Complete step-by-step guide to deploy your RIS application on a VPS using Portainer and Nginx Proxy Manager.

## 📋 Prerequisites

### What You Need on Your VPS:
- ✅ **Nginx Proxy Manager** installed and running
- ✅ **Portainer** installed and accessible
- ✅ A domain name (e.g., `ris.yourdomain.com`)
- ✅ SSH access to your VPS

### VPS Minimum Requirements:
- **RAM**: 4GB (8GB recommended)
- **Storage**: 50GB minimum
- **CPU**: 2 cores minimum

---

## 🎯 Deployment Steps

### **STEP 1: Prepare Your Files on VPS**

#### 1.1 Connect to your VPS via SSH
```bash
ssh root@your-vps-ip
```

#### 1.2 Create project directory
```bash
mkdir -p /opt/RIS
cd /opt/RIS
```

#### 1.3 Upload your project files
**Option A: Using Git (Recommended)**
```bash
git clone https://github.com/yourusername/RIS.git .
```

**Option B: Using SCP from your local machine**
```powershell
# Run this on your local machine (Windows)
scp -r e:\RIS root@your-vps-ip:/opt/RIS
```

**Option C: Using FileZilla/WinSCP**
- Connect to your VPS
- Upload the entire RIS folder to `/opt/RIS`

---

### **STEP 2: Configure Environment Variables**

#### 2.1 Create .env file
```bash
cd /opt/RIS
cp .env.example .env
nano .env
```

#### 2.2 Update the .env file with your values
```bash
# MongoDB Configuration
MONGO_ROOT_USER=risadmin
MONGO_ROOT_PASSWORD=YourSecurePassword123!@#
MONGO_DATABASE=ris_db

# Backend Configuration
JWT_SECRET=YourVeryLongRandomSecretKeyMinimum64CharactersForMaximumSecurity!@#$
FRONTEND_URL=https://ris.yourdomain.com
ORTHANC_URL=http://orthanc-server:8042
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD=orthanc

# Frontend Configuration
NEXT_PUBLIC_API_URL=https://ris.yourdomain.com/api
NEXT_PUBLIC_ORTHANC_URL=http://orthanc-server:8042
```

**Important Tips:**
- Replace `ris.yourdomain.com` with your actual domain
- Generate a strong JWT_SECRET: `openssl rand -base64 64`
- Generate a strong MongoDB password: `openssl rand -base64 32`

#### 2.3 Save and exit
Press `Ctrl+X`, then `Y`, then `Enter`

---

### **STEP 3: Find Your Nginx Proxy Manager Network Name**

Nginx Proxy Manager creates a Docker network that your containers need to connect to.

```bash
# List all Docker networks
docker network ls

# Look for something like:
# npm_default or nginxproxymanager_default
```

#### 3.1 Update docker-compose.portainer.yml

Edit the network name if it's different:
```bash
nano docker-compose.portainer.yml
```

Find this section and update the network name:
```yaml
networks:
  npm-network:
    external: true
    name: npm_default  # Change this to match your NPM network name
```

Common network names:
- `npm_default`
- `nginxproxymanager_default`
- `nginx-proxy-manager_default`

---

### **STEP 4: Deploy with Portainer**

#### Method A: Using Portainer with Git Repository (RECOMMENDED)

##### 4.1 Login to Portainer
Open your browser and go to `http://your-vps-ip:9000`

##### 4.2 Create New Stack
1. Click **"Stacks"** in the left menu
2. Click **"+ Add stack"** button
3. Name it: `RIS`

##### 4.3 Configure Repository
1. Choose **"Repository"** option (NOT Upload or Web Editor)
2. **Repository URL**: Enter your Git repository URL
   - Example: `https://github.com/yourusername/RIS.git`
3. **Repository reference**: `refs/heads/main` (or your branch name)
4. **Compose path**: `docker-compose.portainer.yml`
5. **Authentication**: Add credentials if your repo is private

##### 4.4 Add Environment Variables
Click **"+ Add environment variable"** and add each variable from your `.env` file:

| Name | Value |
|------|-------|
| `MONGO_ROOT_USER` | `risadmin` |
| `MONGO_ROOT_PASSWORD` | `YourSecurePassword123!@#` |
| `MONGO_DATABASE` | `ris_db` |
| `JWT_SECRET` | `Your64CharacterSecret...` |
| `FRONTEND_URL` | `https://ris.yourdomain.com` |
| `ORTHANC_URL` | `http://orthanc-server:8042` |
| `ORTHANC_USERNAME` | `orthanc` |
| `ORTHANC_PASSWORD` | `orthanc` |
| `NEXT_PUBLIC_API_URL` | `https://ris.yourdomain.com/api` |
| `NEXT_PUBLIC_ORTHANC_URL` | `http://orthanc-server:8042` |

**OR** use the .env file directly:
1. Choose **"Load variables from .env file"**
2. Upload your `.env` file

##### 4.5 Deploy
1. Click **"Deploy the stack"**
2. Wait for the build and deployment process (this may take 5-10 minutes)

##### 4.6 Monitor Progress
1. Click on the **"RIS"** stack
2. View **"Logs"** to see build progress
3. Wait until all containers show as **"running"**

#### Method B: Build Images First, Then Deploy (Alternative)

If Git repository method doesn't work, build images on VPS first:

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Navigate to project
cd /opt/RIS

# Build images manually
docker-compose -f docker-compose.portainer.yml build

# Then deploy in Portainer using Web Editor
# (The images will already exist)
```

Then in Portainer:
1. Use **"Web editor"** option
2. Paste the contents of `docker-compose.portainer.yml`
3. Add environment variables
4. Deploy (it will use the pre-built images)

#### Method C: Using Command Line (Simplest)

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Navigate to project
cd /opt/RIS

# Deploy directly
docker-compose -f docker-compose.portainer.yml up -d --build
```

This deploys without Portainer UI but you can still manage it in Portainer afterwards.

---

### **STEP 5: Verify Deployment**

#### 5.1 Check container status
```bash
docker ps
```

You should see 3 containers running:
- `ris-frontend`
- `ris-backend`
- `ris-mongodb`

#### 5.2 Check logs
```bash
# All containers
docker-compose -f docker-compose.portainer.yml logs -f

# Individual containers
docker logs ris-frontend
docker logs ris-backend
docker logs ris-mongodb
```

#### 5.3 Test backend health
```bash
curl http://localhost:5000/health
```

Should return: `{"status":"ok"}`

---

### **STEP 6: Configure Nginx Proxy Manager**

Now set up the reverse proxy to make your application accessible via domain.

#### 6.1 Login to Nginx Proxy Manager
Open `http://your-vps-ip:81` in your browser

#### 6.2 Add Proxy Host for Frontend

1. Click **"Proxy Hosts"** → **"Add Proxy Host"**

**Details Tab:**
- **Domain Names**: `ris.yourdomain.com`
- **Scheme**: `http`
- **Forward Hostname/IP**: `ris-frontend` (container name)
- **Forward Port**: `3000`
- ✅ **Cache Assets**
- ✅ **Block Common Exploits**
- ✅ **Websockets Support**

**SSL Tab:**
- ✅ **SSL Certificate**: Request New SSL Certificate (Let's Encrypt)
- ✅ **Force SSL**
- ✅ **HTTP/2 Support**
- ✅ **HSTS Enabled**
- Enter your email address
- ✅ Agree to Let's Encrypt Terms of Service
- Click **"Save"**

#### 6.3 Add Proxy Host for Backend API

1. Click **"Add Proxy Host"** again

**Details Tab:**
- **Domain Names**: `ris.yourdomain.com/api`
- **Scheme**: `http`
- **Forward Hostname/IP**: `ris-backend`
- **Forward Port**: `5000`
- ✅ **Block Common Exploits**
- ✅ **Websockets Support**

**Custom Locations Tab:**
1. Click **"Add location"**
   - **Define location**: `/api`
   - **Scheme**: `http`
   - **Forward Hostname/IP**: `ris-backend`
   - **Forward Port**: `5000`

**Advanced Tab:**
Add this custom configuration:
```nginx
location /api {
    rewrite ^/api/(.*) /$1 break;
    proxy_pass http://ris-backend:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**SSL Tab:**
- Select the same SSL certificate created in step 6.2

Click **"Save"**

---

### **STEP 7: Configure DNS**

#### 7.1 Add DNS A Record
In your domain registrar's DNS settings:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | ris | `your-vps-ip` | 3600 |

Or if using subdomain:
| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `your-vps-ip` | 3600 |

Wait 5-10 minutes for DNS propagation.

#### 7.2 Test DNS
```bash
# On your local machine
nslookup ris.yourdomain.com
ping ris.yourdomain.com
```

---

### **STEP 8: Access Your Application**

1. Open your browser
2. Go to: `https://ris.yourdomain.com`
3. You should see the login page

**Default Credentials:**
- **Username**: `admin`
- **Password**: Check your backend initialization code or logs

---

## 🔍 Verification Checklist

- [ ] All 3 containers running in Portainer
- [ ] Backend health endpoint responding
- [ ] Frontend accessible via domain
- [ ] SSL certificate active (HTTPS working)
- [ ] Can login to the application
- [ ] MongoDB data persisting (check volumes)
- [ ] Logs show no errors

---

## 🛠️ Troubleshooting

### "path './backend' not found" Error in Portainer

This happens when using **Upload** or **Web Editor** method because Portainer can't access your build context.

**Solutions:**

**Option 1: Use Git Repository method (BEST)**
1. Push your code to GitHub/GitLab
2. In Portainer, use **"Repository"** option instead of Upload
3. Enter your Git URL and deploy

**Option 2: Build on VPS first**
```bash
# SSH to VPS
cd /opt/RIS

# Build images
docker-compose -f docker-compose.portainer.yml build

# Then use Portainer Web Editor to deploy
# (Images already exist, no build needed)
```

**Option 3: Use Command Line**
```bash
cd /opt/RIS
docker-compose -f docker-compose.portainer.yml up -d --build
```
Then manage via Portainer UI.

### Container won't start
```bash
# Check logs
docker logs ris-backend
docker logs ris-frontend
docker logs ris-mongodb

# Check in Portainer
Go to Containers → Click on container → View logs
```

### Cannot access via domain
1. **Check DNS**: `nslookup ris.yourdomain.com`
2. **Check NPM logs**: In NPM → Logs tab
3. **Check firewall**: 
   ```bash
   sudo ufw status
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

### SSL Certificate not working
1. Make sure ports 80 and 443 are open
2. DNS must be pointing to your VPS IP
3. Try regenerating certificate in NPM
4. Check NPM logs for errors

### Backend can't connect to MongoDB
1. Check MongoDB logs: `docker logs ris-mongodb`
2. Verify .env variables are correct
3. Restart backend: `docker restart ris-backend`

### Network connection issues
```bash
# Make sure npm-network exists
docker network ls

# Connect containers manually if needed
docker network connect npm_default ris-frontend
docker network connect npm_default ris-backend
```

---

## 📊 Monitoring & Maintenance

### View Container Stats in Portainer
1. Go to **Containers**
2. Click on container name
3. View **Stats**, **Logs**, **Console**, etc.

### Backup Database
```bash
# Create backup
docker exec ris-mongodb mongodump \
  --username=risadmin \
  --password=YourPassword \
  --authenticationDatabase=admin \
  --db=ris_db \
  --out=/data/backup

# Copy to host
docker cp ris-mongodb:/data/backup /opt/backups/ris-$(date +%Y%m%d)
```

### Update Application
```bash
cd /opt/RIS
git pull
docker-compose -f docker-compose.portainer.yml up -d --build
```

Or use Portainer:
1. Go to **Stacks** → **RIS**
2. Click **"Editor"**
3. Make changes
4. Click **"Update the stack"**
5. ✅ **Re-pull image and redeploy**

### View Logs
In Portainer:
1. **Stacks** → **RIS** → **Logs**
2. Or **Containers** → Click container → **Logs**

Command line:
```bash
docker logs -f ris-backend
docker logs -f ris-frontend
docker logs -f ris-mongodb
```

---

## 🔐 Security Best Practices

1. ✅ **Use strong passwords** in .env
2. ✅ **Enable firewall** (UFW)
3. ✅ **Use HTTPS** (SSL certificates)
4. ✅ **Don't expose MongoDB port** publicly
5. ✅ **Regular backups**
6. ✅ **Keep Docker images updated**
7. ✅ **Monitor logs** for suspicious activity
8. ✅ **Change default admin password** after first login

---

## 📝 Quick Reference Commands

```bash
# View all containers
docker ps

# View logs
docker logs -f ris-backend

# Restart container
docker restart ris-backend

# Stop all
docker-compose -f docker-compose.portainer.yml down

# Start all
docker-compose -f docker-compose.portainer.yml up -d

# Rebuild specific service
docker-compose -f docker-compose.portainer.yml up -d --build backend

# Access container shell
docker exec -it ris-backend sh

# Access MongoDB
docker exec -it ris-mongodb mongosh -u risadmin -p
```

---

## 🎉 Success!

Your RIS application should now be running at:
- **Frontend**: `https://ris.yourdomain.com`
- **Backend API**: `https://ris.yourdomain.com/api`

**Next Steps:**
1. Change default admin password
2. Set up automated backups
3. Configure monitoring
4. Test all functionality
5. Train your users

---

## 📞 Need Help?

If you encounter issues:
1. Check the logs first
2. Review troubleshooting section
3. Verify all environment variables
4. Check Docker network connectivity
5. Ensure DNS is properly configured

Happy deploying! 🚀
