# Deployment Guide

This guide covers deploying the RIS system to production.

## Architecture Overview

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Frontend  │─────▶│   Backend   │─────▶│   Orthanc   │
│  (Next.js)  │      │ (Express.js)│      │    PACS     │
│   Vercel    │      │   Railway   │      │pacs.58wilaya│
└─────────────┘      └─────────────┘      └─────────────┘
                             │
                             ▼
                      ┌─────────────┐
                      │  MongoDB    │
                      │   Atlas     │
                      └─────────────┘
```

## Option 1: Recommended Stack (Easiest & Free Tier Available)

- **Frontend**: Vercel
- **Backend**: Railway or Render
- **Database**: MongoDB Atlas

---

## Backend Deployment

### Option A: Railway (Recommended)

**Advantages**: Easy setup, free tier, automatic deploys

1. **Prepare Backend**
   ```bash
   cd backend
   # Make sure package.json has start script
   ```

2. **Create Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

3. **Deploy**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository → `backend` folder
   - Railway auto-detects Node.js

4. **Set Environment Variables**
   
   In Railway dashboard → Variables:
   ```
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=your_mongodb_atlas_connection_string
   JWT_SECRET=your_secure_random_secret_min_32_chars
   ORTHANC_URL=https://pacs.58wilaya.com
   ORTHANC_USERNAME=your_orthanc_username
   ORTHANC_PASSWORD=your_orthanc_password
   FRONTEND_URL=https://your-frontend-url.vercel.app
   ```

5. **Deploy**
   - Railway automatically deploys
   - Get your backend URL: `https://your-app.railway.app`

---

### Option B: Render

**Advantages**: Free tier, easy setup

1. **Create Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create Web Service**
   - New → Web Service
   - Connect your repository
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Environment Variables**
   
   Same as Railway (see above)

4. **Add MongoDB**
   - Render offers managed MongoDB
   - Or use MongoDB Atlas

---

### Option C: Heroku

1. **Install Heroku CLI**
   ```bash
   # Windows (PowerShell as Admin)
   winget install Heroku.HerokuCLI
   ```

2. **Login and Deploy**
   ```bash
   cd backend
   heroku login
   heroku create your-ris-backend
   
   # Set environment variables
   heroku config:set NODE_ENV=production
   heroku config:set MONGODB_URI=your_connection_string
   heroku config:set JWT_SECRET=your_secret
   # ... (set all other env vars)
   
   # Deploy
   git push heroku main
   ```

---

## Database Setup (MongoDB Atlas)

**Why Atlas?** Free tier, managed, reliable, no maintenance

1. **Create Account**
   - Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   - Sign up (free)

2. **Create Cluster**
   - Build a Database → Free tier (M0)
   - Choose a cloud provider & region (closest to your backend)
   - Cluster name: `ris-cluster`

3. **Configure Access**
   - Database Access → Add New Database User
   - Username: `ris_admin`
   - Password: Generate secure password
   - Role: `Atlas admin`

4. **Network Access**
   - Network Access → Add IP Address
   - **Allow Access from Anywhere**: `0.0.0.0/0`
   - (In production, restrict to specific IPs)

5. **Get Connection String**
   - Clusters → Connect → Connect your application
   - Copy connection string:
   ```
   mongodb+srv://ris_admin:<password>@ris-cluster.xxxxx.mongodb.net/ris_db?retryWrites=true&w=majority
   ```
   - Replace `<password>` with actual password
   - Use this as `MONGODB_URI` in backend

---

## Frontend Deployment

### Vercel (Recommended)

**Advantages**: Built for Next.js, automatic deployments, free SSL

1. **Prepare Frontend**
   ```bash
   cd frontend
   # Ensure .env.local is NOT committed (it's in .gitignore)
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub
   - Import your repository
   - Framework: Next.js (auto-detected)
   - Root Directory: `frontend`

3. **Environment Variables**
   
   In Vercel dashboard → Settings → Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
   NEXT_PUBLIC_ORTHANC_URL=https://pacs.58wilaya.com
   ```

4. **Deploy**
   - Vercel automatically builds and deploys
   - Your app is live at: `https://your-app.vercel.app`

5. **Update Backend CORS**
   
   In backend environment variables, update:
   ```
   FRONTEND_URL=https://your-app.vercel.app
   ```

---

### Alternative: Netlify

1. **Build locally**
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy**
   - Go to [netlify.com](https://netlify.com)
   - Drag & drop the `.next` folder
   - Or connect GitHub for automatic deploys

3. **Environment Variables**
   
   Same as Vercel

---

## Custom Domain Setup

### For Vercel Frontend

1. **Vercel Dashboard** → Your Project → Settings → Domains
2. Add your domain (e.g., `ris.yourhospital.com`)
3. Update DNS records at your domain registrar:
   ```
   Type: CNAME
   Name: ris
   Value: cname.vercel-dns.com
   ```

### For Railway Backend

1. **Railway Dashboard** → Your Service → Settings → Domains
2. Add custom domain (e.g., `api.yourhospital.com`)
3. Update DNS records:
   ```
   Type: CNAME
   Name: api
   Value: your-app.railway.app
   ```

---

## SSL/HTTPS

✅ **Good news**: All recommended platforms (Vercel, Railway, Render) provide **automatic free SSL certificates**.

No configuration needed - HTTPS works out of the box!

---

## Production Checklist

Before going live:

### Security
- [ ] Changed default admin password
- [ ] Strong JWT_SECRET (min 32 random characters)
- [ ] MongoDB Atlas with strong password
- [ ] Orthanc credentials secured
- [ ] HTTPS enabled everywhere
- [ ] CORS restricted to frontend domain only
- [ ] MongoDB network access restricted (if possible)

### Configuration
- [ ] All environment variables set correctly
- [ ] Frontend points to production backend URL
- [ ] Backend allows frontend domain in CORS
- [ ] Orthanc connection tested from production backend
- [ ] MongoDB connection tested

### Testing
- [ ] Login works
- [ ] Can fetch studies from PACS
- [ ] OHIF viewer loads images
- [ ] Can create and save reports
- [ ] Can finalize reports
- [ ] User management works (admin only)

### Monitoring
- [ ] Set up error logging (e.g., Sentry)
- [ ] Monitor backend uptime
- [ ] Monitor database size
- [ ] Set up backups for MongoDB

---

## Backup Strategy

### MongoDB Atlas Backups

1. **Automatic Backups**
   - Atlas free tier includes point-in-time backups
   - Enabled by default

2. **Manual Backup**
   ```bash
   mongodump --uri="mongodb+srv://..." --out=./backup
   ```

### Regular Backups Schedule

- **Daily**: Automatic (Atlas)
- **Weekly**: Manual export of reports
- **Monthly**: Full database backup download

---

## Scaling Considerations

### When to Scale?

- More than 50 concurrent users
- More than 10,000 studies
- Response time > 2 seconds

### Scaling Options

1. **Database**: Upgrade MongoDB Atlas tier
2. **Backend**: Increase Railway/Render instances
3. **Frontend**: Vercel scales automatically
4. **Caching**: Add Redis for study list caching

---

## Cost Estimate

### Free Tier (Development/Small Clinic)

- ✅ Vercel: Free (100GB bandwidth/month)
- ✅ Railway: $5/month free credit (enough for small usage)
- ✅ MongoDB Atlas: Free (512MB storage)
- ✅ **Total**: Free - $5/month

### Small Hospital (~100 users, 1000 studies/month)

- Frontend (Vercel Pro): $20/month
- Backend (Railway): $10/month
- Database (Atlas M10): $25/month
- **Total**: ~$55/month

### Medium Hospital (~500 users, 5000 studies/month)

- Frontend (Vercel): $20/month
- Backend (Railway/Render): $25/month
- Database (Atlas M20): $75/month
- **Total**: ~$120/month

---

## Maintenance

### Weekly Tasks
- Check error logs
- Monitor database size
- Review user activity

### Monthly Tasks
- Update dependencies (npm update)
- Review and rotate secrets
- Database backup verification
- Performance review

### Quarterly Tasks
- Security audit
- Update Node.js/MongoDB versions
- Review and optimize database indexes
- User access audit

---

## Rollback Plan

If something goes wrong after deployment:

### Vercel Frontend
- Deployments → Previous deployment → Promote to Production

### Railway Backend
- Deployments → Select previous successful deployment → Redeploy

### Database
- MongoDB Atlas → Restore from snapshot

---

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Railway Docs**: https://docs.railway.app
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com
- **Next.js Docs**: https://nextjs.org/docs
- **Express.js Docs**: https://expressjs.com

---

## Congratulations! 🚀

Your RIS system is now in production and ready to serve radiologists!

**Post-Deployment**:
1. Share login credentials with your team
2. Provide user training
3. Monitor system for first few days
4. Collect feedback and iterate

Good luck! 🏥
