# Quick Start Guide

This guide will help you get the RIS system up and running in under 10 minutes.

## System Requirements

- **Node.js** 18 or higher ([Download](https://nodejs.org/))
- **MongoDB** ([Download](https://www.mongodb.com/try/download/community)) OR [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free cloud option)
- **Orthanc PACS** server with credentials (you already have pacs.58wilaya.com)

## Step-by-Step Setup

### 1️⃣ Setup Backend (5 minutes)

Open PowerShell in the `backend` folder:

```powershell
cd backend

# Install dependencies
npm install

# Create .env file
Copy-Item .env.example .env

# Edit .env with your favorite editor (Notepad, VS Code, etc.)
notepad .env
```

**Edit `.env` file** - Update these values:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ris_db
JWT_SECRET=change-this-to-a-random-32-character-string
NODE_ENV=development

ORTHANC_URL=https://pacs.58wilaya.com
ORTHANC_USERNAME=your_actual_username
ORTHANC_PASSWORD=your_actual_password

FRONTEND_URL=http://localhost:3000
```

**Start MongoDB** (if using local installation):

```powershell
# As Administrator
net start MongoDB
```

**Start the backend server**:

```powershell
npm run dev
```

✅ You should see: "🚀 RIS Backend server running on port 5000"

---

### 2️⃣ Setup Frontend (3 minutes)

Open a **NEW** PowerShell window in the `frontend` folder:

```powershell
cd frontend

# Install dependencies
npm install

# Create .env.local file
Copy-Item .env.local.example .env.local

# Edit if needed (defaults should work)
notepad .env.local
```

**Start the frontend**:

```powershell
npm run dev
```

✅ You should see: "Ready - started server on http://localhost:3000"

---

### 3️⃣ Login and Test (2 minutes)

1. **Open your browser**: http://localhost:3000

2. **Login with default credentials**:
   - Email: `admin@ris.com`
   - Password: `admin123`

3. **You're in!** 🎉

---

## What to Do Next

### First Time Setup Checklist

- [ ] **Change Admin Password**
  - Click on your name → Settings (when implemented)
  - Or create a new admin user and delete the default one

- [ ] **Create Radiologist Accounts**
  - Go to "Users" tab
  - Click "Add User"
  - Fill in details and assign "Radiologist" role

- [ ] **Test PACS Connection**
  - Go to "Worklist" tab
  - You should see studies from Orthanc
  - If empty, check date filters or Orthanc server

- [ ] **Create Your First Report**
  - Click on any study
  - Click "Create Report"
  - View images on left, write report on right
  - Save as draft or finalize

---

## Common Issues & Quick Fixes

### ❌ Backend won't start - "MongoDB connection error"

**Fix**: Start MongoDB service

```powershell
# Windows (as Admin)
net start MongoDB

# Or check if MongoDB is installed
mongod --version
```

**Alternative**: Use MongoDB Atlas (cloud) instead:
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free cluster
3. Get connection string
4. Update `MONGODB_URI` in backend `.env`

---

### ❌ Frontend shows "Network Error"

**Fix**: Make sure backend is running on port 5000

```powershell
# Check if backend is running
curl http://localhost:5000/health
```

---

### ❌ "Failed to fetch studies" or "Orthanc connection failed"

**Fix**: Check Orthanc credentials in backend `.env`

```powershell
# Test Orthanc connection manually
curl -u username:password https://pacs.58wilaya.com/system
```

---

### ❌ OHIF Viewer shows blank screen

**Possible causes**:
1. OHIF plugin not installed in Orthanc
2. Study has no images
3. Incorrect StudyInstanceUID

**Fix**: 
- Check OHIF is accessible: https://pacs.58wilaya.com/ohif
- Verify study exists in Orthanc

---

## Quick Reference

### Default Ports
- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:3000
- **MongoDB**: localhost:27017

### Default Login
- **Email**: admin@ris.com
- **Password**: admin123

### Folder Structure
```
RIS/
├── backend/          # Express.js API
│   ├── src/
│   └── .env         # Backend config
│
├── frontend/        # Next.js app
│   ├── src/
│   └── .env.local   # Frontend config
│
└── README.md        # This file
```

### Stop Servers

Press `Ctrl + C` in each PowerShell window to stop the servers.

---

## Next Steps

- 📖 Read the full [Backend README](./backend/README.md)
- 📖 Read the full [Frontend README](./frontend/README.md)
- 🚀 Deploy to production (see deployment guides in READMEs)

---

## Getting Help

If you're stuck:

1. Check the error message carefully
2. Read the troubleshooting section in backend/frontend READMEs
3. Verify all environment variables are correct
4. Ensure both backend and frontend are running
5. Check MongoDB is running (if using local)

---

## Congratulations! 🎊

You now have a fully functional Radiology Information System running locally. You can:

- ✅ View patient studies from your Orthanc PACS
- ✅ Create and manage radiology reports
- ✅ View DICOM images with OHIF Viewer
- ✅ Manage users and access control
- ✅ Track report status (Draft/Final)

**Happy reporting!** 🏥
