# 🔧 Troubleshooting Guide

Common issues and their solutions when running the RIS application.

---

## 🚨 Backend Issues

### Issue: MongoDB Connection Error

**Error Message**:
```
❌ MongoDB connection error: MongoServerError: connect ECONNREFUSED
```

**Causes**:
1. MongoDB is not running
2. Wrong connection string in `.env`
3. MongoDB not installed

**Solutions**:

**Windows**:
```powershell
# Check if MongoDB is installed
mongod --version

# Start MongoDB service (as Administrator)
net start MongoDB

# If service doesn't exist, start manually
mongod --dbpath C:\data\db
```

**Linux**:
```bash
sudo systemctl start mongod
sudo systemctl enable mongod  # Auto-start on boot
```

**macOS**:
```bash
brew services start mongodb-community
```

**Alternative**: Use MongoDB Atlas (cloud):
1. Sign up at mongodb.com/cloud/atlas
2. Create free cluster
3. Get connection string
4. Update `MONGODB_URI` in backend `.env`

---

### Issue: Orthanc Connection Failed

**Error Message**:
```
Failed to fetch studies from PACS
```

**Causes**:
1. Wrong Orthanc URL
2. Incorrect username/password
3. Orthanc server is down
4. Network/firewall blocking connection

**Solutions**:

1. **Test Orthanc manually**:
```bash
curl -u username:password https://pacs.58wilaya.com/system
```

2. **Check credentials**:
- Verify `ORTHANC_USERNAME` and `ORTHANC_PASSWORD` in backend `.env`
- Check Orthanc's `orthanc.json` file for correct credentials

3. **Verify Orthanc is running**:
```bash
curl https://pacs.58wilaya.com
# Should return HTML or Orthanc Explorer
```

4. **Check backend logs**:
```bash
# Look for Orthanc-related errors
npm run dev
# Watch console output
```

---

### Issue: Port Already in Use

**Error Message**:
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solutions**:

**Option 1**: Kill the process using port 5000

**Windows**:
```powershell
# Find process
netstat -ano | findstr :5000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

**Linux/Mac**:
```bash
# Find and kill
lsof -ti:5000 | xargs kill
```

**Option 2**: Change port
```env
# In backend/.env
PORT=5001
```

Then update frontend API URL:
```env
# In frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:5001/api
```

---

### Issue: JWT_SECRET Not Set

**Error Message**:
```
JWT_SECRET is not defined
```

**Solution**:
```bash
# Generate a secure random secret
openssl rand -base64 32

# Or use PowerShell
[Convert]::ToBase64String((1..32|ForEach-Object{Get-Random -Minimum 0 -Maximum 256}))

# Add to backend/.env
JWT_SECRET=your_generated_secret_here
```

---

### Issue: Default Admin Not Created

**Error Message**:
```
Login failed: Invalid credentials
```

**Solution**:
```bash
# Restart backend to trigger admin seed
cd backend
npm run dev

# Look for this message:
# ✅ Default admin user created: admin@ris.com / admin123

# If still not created, manually seed:
# Create backend/src/scripts/seedAdmin.js and run it
```

---

## 💻 Frontend Issues

### Issue: Network Error / API Connection Failed

**Error Message** (in browser console):
```
Network Error
Failed to fetch
```

**Causes**:
1. Backend not running
2. Wrong API URL
3. CORS issue

**Solutions**:

1. **Verify backend is running**:
```bash
# Test backend health endpoint
curl http://localhost:5000/health

# Should return: {"status":"ok",...}
```

2. **Check frontend `.env.local`**:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
# ^^^ Make sure this matches backend URL
```

3. **Check CORS settings**:
```javascript
// In backend/src/server.js, verify:
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

4. **Clear browser cache**:
- Open DevTools (F12)
- Right-click reload button
- Select "Empty Cache and Hard Reload"

---

### Issue: OHIF Viewer Shows Blank Screen

**Error Message**:
Iframe is blank or shows error

**Causes**:
1. OHIF plugin not installed in Orthanc
2. Wrong StudyInstanceUID
3. Orthanc not accessible from browser

**Solutions**:

1. **Test OHIF directly**:
```
# In browser, navigate to:
https://pacs.58wilaya.com/ohif

# Should show OHIF interface
```

2. **Check if OHIF plugin is installed in Orthanc**:
```bash
curl https://pacs.58wilaya.com/plugins
# Should list "ohif" or "osimis-web-viewer"
```

3. **Verify study exists**:
```bash
# Check if study is in Orthanc
curl -u username:password https://pacs.58wilaya.com/studies
```

4. **Check browser console**:
- Open DevTools (F12) → Console tab
- Look for iframe errors or CORS warnings

---

### Issue: Styles Not Loading / Unstyled Page

**Symptoms**:
- Page appears with no styling
- Plain HTML only

**Solutions**:

1. **Reinstall dependencies**:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

2. **Clear Next.js cache**:
```bash
cd frontend
rm -rf .next
npm run dev
```

3. **Verify Tailwind config**:
```javascript
// frontend/tailwind.config.js should include:
content: [
  './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
  './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  './src/app/**/*.{js,ts,jsx,tsx,mdx}',
],
```

---

### Issue: Unauthorized / Redirected to Login

**Symptoms**:
- Immediately redirected to login after logging in
- "Unauthorized" errors

**Solutions**:

1. **Check token in localStorage**:
```javascript
// In browser console:
localStorage.getItem('token')
// Should return a JWT string
```

2. **Clear localStorage and try again**:
```javascript
// In browser console:
localStorage.clear()
// Then login again
```

3. **Verify JWT_SECRET matches** between logins:
- If you changed `JWT_SECRET` in backend, old tokens are invalid
- Clear localStorage and login again

4. **Check token expiration**:
```javascript
// In backend/src/routes/auth.js:
const token = jwt.sign(
  { userId: user._id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '24h' } // ← Increase if needed
);
```

---

### Issue: Rich Text Editor Not Working

**Symptoms**:
- Editor toolbar doesn't appear
- Can't format text
- Editor is just a plain textarea

**Solutions**:

1. **Check TipTap installation**:
```bash
cd frontend
npm list @tiptap/react
# Should show version 2.1.x
```

2. **Reinstall TipTap**:
```bash
npm uninstall @tiptap/react @tiptap/starter-kit @tiptap/extension-text-align @tiptap/extension-underline
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-text-align @tiptap/extension-underline
```

3. **Check browser console**:
- Look for TipTap-related errors
- ProseMirror warnings

---

## 🗄️ Database Issues

### Issue: Collection Not Found

**Error Message**:
```
Collection 'users' not found
```

**Solution**:
MongoDB collections are created automatically when first document is inserted. This is usually not an issue, but if it persists:

```bash
# Connect to MongoDB
mongosh

# Use RIS database
use ris_db

# Create collections manually
db.createCollection("users")
db.createCollection("reports")

# Exit
exit
```

---

### Issue: Duplicate Key Error

**Error Message**:
```
E11000 duplicate key error collection: ris_db.users index: email_1
```

**Cause**:
Trying to create user with email that already exists

**Solution**:
```bash
# Check existing users
mongosh
use ris_db
db.users.find({}, {email: 1})

# Delete duplicate if needed
db.users.deleteOne({email: "duplicate@email.com"})
```

---

## 🌐 Production Issues

### Issue: Environment Variables Not Loaded

**Symptoms**:
- App works locally but not in production
- "undefined" errors for env variables

**Solutions**:

**Vercel** (Frontend):
1. Dashboard → Project → Settings → Environment Variables
2. Add all `NEXT_PUBLIC_*` variables
3. Redeploy

**Railway** (Backend):
1. Dashboard → Project → Variables
2. Add all environment variables
3. Redeploy

**Note**: Environment variables must be set in the hosting platform, not in `.env` files (which are git-ignored).

---

### Issue: CORS Error in Production

**Error Message** (browser console):
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution**:

Update backend CORS to allow production frontend URL:

```javascript
// backend/src/server.js
app.use(cors({
  origin: [
    'http://localhost:3000',           // Local
    'https://your-app.vercel.app',    // Production
    process.env.FRONTEND_URL           // From env
  ],
  credentials: true
}));
```

Or set in backend environment:
```env
FRONTEND_URL=https://your-app.vercel.app
```

---

### Issue: MongoDB Atlas Connection Timeout

**Error Message**:
```
MongoServerSelectionError: connection timed out
```

**Solutions**:

1. **Whitelist IP addresses**:
- MongoDB Atlas → Network Access
- Add IP Address → 0.0.0.0/0 (allow all)
- Or add specific IPs of your hosting platform

2. **Check connection string**:
```env
# Correct format:
MONGODB_URI=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/ris_db?retryWrites=true&w=majority

# Replace <password> with actual password
# No < > brackets in actual value
```

3. **Verify database user**:
- MongoDB Atlas → Database Access
- Ensure user has read/write permissions

---

## 📱 Browser-Specific Issues

### Issue: Works in Chrome but not Safari

**Symptoms**:
- Features work in Chrome/Edge
- Broken in Safari

**Common causes**:
1. **Third-party cookies**: Safari blocks by default
2. **localStorage**: Check if accessible in iframe

**Solutions**:
- Test in Safari's private mode
- Check browser console for specific errors
- Ensure HTTPS in production (Safari stricter with HTTP)

---

### Issue: Slow Performance

**Symptoms**:
- Pages load slowly
- Lag when typing in editor
- Delayed table rendering

**Solutions**:

1. **Check network tab** (DevTools):
- Look for slow API calls
- Large payload sizes

2. **Optimize queries**:
```javascript
// Add pagination to large lists
const studies = await studiesAPI.getAll({ 
  page: 1, 
  limit: 50 
});
```

3. **Clear browser cache**:
- Settings → Privacy → Clear browsing data

4. **Check database indexes**:
```javascript
// In backend/src/models/Report.js
reportSchema.index({ studyInstanceUid: 1 });
reportSchema.index({ studyDate: -1 });
```

---

## 🆘 Emergency Recovery

### Complete Reset (Last Resort)

If everything is broken:

```bash
# 1. Stop all servers
# Press Ctrl+C in all terminals

# 2. Clean backend
cd backend
rm -rf node_modules package-lock.json
npm install

# 3. Clean frontend
cd ../frontend
rm -rf node_modules .next package-lock.json
npm install

# 4. Reset database (WARNING: Deletes all data!)
mongosh
use ris_db
db.dropDatabase()
exit

# 5. Restart everything
cd backend
npm run dev

# In new terminal:
cd frontend
npm run dev
```

---

## 📞 Getting Help

If none of these solutions work:

1. **Check logs**:
   - Backend: Terminal output
   - Frontend: Browser console (F12)
   - MongoDB: MongoDB logs

2. **Error details**:
   - Full error message
   - Stack trace
   - Steps to reproduce

3. **Environment info**:
   - Node.js version: `node --version`
   - MongoDB version: `mongod --version`
   - Operating system

4. **Test in isolation**:
   - Does backend health check work?
   - Does frontend build successfully?
   - Can you connect to MongoDB?
   - Can you access Orthanc directly?

---

## ✅ Prevention Checklist

Avoid issues before they happen:

- [ ] Keep dependencies updated: `npm update`
- [ ] Use version control (Git)
- [ ] Backup MongoDB regularly
- [ ] Monitor logs in production
- [ ] Test after each major change
- [ ] Use environment variables correctly
- [ ] Document custom configurations
- [ ] Keep `.env.example` files updated

---

**Remember**: Most issues are configuration-related. Double-check your environment variables first! 🔍
