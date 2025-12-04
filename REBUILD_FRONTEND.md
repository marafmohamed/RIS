# 🔄 Rebuild Frontend with Correct Environment Variables

## Problem
Frontend is using `http://localhost:5000/api` instead of `https://rapport.58wilaya.com/api` because the Docker image was built with the wrong environment variables.

## Solution

### **Option 1: Rebuild on VPS (RECOMMENDED)**

SSH into your VPS and run:

```bash
cd /opt/RIS

# Stop the frontend container
docker stop ris-frontend

# Remove old container and image
docker rm ris-frontend
docker rmi ris-frontend

# Rebuild with correct environment variables
docker-compose -f docker-compose.portainer.yml build --no-cache frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://rapport.58wilaya.com/api \
  --build-arg NEXT_PUBLIC_ORTHANC_URL=http://orthanc-server:8042

# Restart all services
docker-compose -f docker-compose.portainer.yml up -d
```

### **Option 2: Rebuild Everything (Full Clean)**

```bash
cd /opt/RIS

# Stop all containers
docker-compose -f docker-compose.portainer.yml down

# Rebuild all services
docker-compose -f docker-compose.portainer.yml build --no-cache

# Start everything
docker-compose -f docker-compose.portainer.yml up -d
```

### **Option 3: Using Portainer UI**

1. Go to Portainer → **Stacks** → **RIS**
2. Click **"Editor"**
3. Make sure your environment variables are correct:
   - `NEXT_PUBLIC_API_URL=https://rapport.58wilaya.com/api`
   - `NEXT_PUBLIC_ORTHANC_URL=http://orthanc-server:8042`
4. Check **"Re-pull image and redeploy"**
5. Click **"Update the stack"**
6. Wait 5-10 minutes for rebuild

---

## Verify After Rebuild

1. **Check frontend logs:**
```bash
docker logs ris-frontend
```

2. **Access the site:**
Open `https://rapport.58wilaya.com` in browser

3. **Check browser console:**
- Open Developer Tools (F12)
- Try to login
- Check Network tab - API calls should go to `https://rapport.58wilaya.com/api`

4. **Test API endpoint:**
```bash
curl https://rapport.58wilaya.com/api/health
```

---

## Why This Happens

Next.js **bakes** `NEXT_PUBLIC_*` environment variables into the build at **build time**, not runtime. 

- ❌ **Wrong**: Setting env vars after build
- ✅ **Right**: Setting env vars BEFORE/DURING build using `--build-arg`

---

## Prevention

Always ensure your `.env` file on the VPS has:
```bash
NEXT_PUBLIC_API_URL=https://rapport.58wilaya.com/api
NEXT_PUBLIC_ORTHANC_URL=http://orthanc-server:8042
```

And rebuild when changing these values.
