# 🏥 Radiology Information System (RIS)

> A professional cloud-based teleradiology RIS that interfaces with Orthanc PACS server.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-green.svg)](https://www.mongodb.com/)

## 🎯 Quick Links

### 📚 Documentation
- 📖 **[Quick Start Guide](QUICKSTART.md)** - Get running in 10 minutes
- 🚀 **[Deployment Guide](DEPLOYMENT.md)** - Deploy to production  
- 📋 **[Project Structure](STRUCTURE.md)** - Architecture & code organization
- 📦 **[Project Summary](PROJECT_SUMMARY.md)** - Complete feature list
- 🎨 **[Visual Guide](VISUAL_GUIDE.md)** - UI/UX walkthrough
- 🔧 **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues & solutions

### 🎯 Component Guides
- 🖥️ **[Backend README](backend/README.md)** - Backend setup & API docs
- 💻 **[Frontend README](frontend/README.md)** - Frontend setup & deployment

## 🏗️ Architecture

- **Frontend**: Next.js 14 + Tailwind CSS
- **Backend**: Express.js + Node.js
- **Database**: MongoDB (for flexible document storage)
- **PACS Integration**: Orthanc at https://pacs.58wilaya.com
- **Image Viewer**: OHIF Viewer (embedded via iframe)

## Features

- ✅ Multi-user authentication with role-based access (Admin, Radiologist)
- ✅ Worklist dashboard with patient studies from Orthanc
- ✅ Split-screen reporting interface (OHIF Viewer + Rich Text Editor)
- ✅ Report management (Draft, Finalized)
- ✅ Real-time study synchronization with PACS

## Project Structure

```
RIS/
├── backend/          # Express.js API server
│   ├── src/
│   │   ├── config/   # Configuration files
│   │   ├── models/   # MongoDB models
│   │   ├── routes/   # API routes
│   │   ├── middleware/ # Auth & validation
│   │   ├── services/ # Business logic
│   │   └── server.js # Entry point
│   └── package.json
│
├── frontend/         # Next.js application
│   ├── src/
│   │   ├── app/      # Next.js 14 app directory
│   │   ├── components/ # React components
│   │   ├── lib/      # Utilities & API client
│   │   └── types/    # TypeScript types
│   └── package.json
│
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- MongoDB installed locally or MongoDB Atlas account
- Access to Orthanc PACS server (pacs.58wilaya.com)

### 1. Setup Backend

```bash
cd backend
npm install
```

Create `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ris_db
JWT_SECRET=your-super-secret-jwt-key-change-this
NODE_ENV=development

# Orthanc PACS Configuration
ORTHANC_URL=https://pacs.58wilaya.com
ORTHANC_USERNAME=your_orthanc_username
ORTHANC_PASSWORD=your_orthanc_password
```

Start the backend:
```bash
npm run dev
```

### 2. Setup Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Start the frontend:
```bash
npm run dev
```

### 3. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### Default Admin Account

First run will create a default admin account:
- **Email**: admin@ris.com
- **Password**: admin123

⚠️ **Change this password immediately after first login!**

## Usage Guide

### For Administrators

1. Login with admin credentials
2. Navigate to **User Management**
3. Create radiologist accounts
4. Manage user roles and permissions

### For Radiologists

1. Login with your credentials
2. **Dashboard/Worklist**: View all patient studies from Orthanc
3. Click **Report** on any study to open the reporting interface
4. **Left Panel**: View DICOM images via OHIF Viewer
5. **Right Panel**: Write your findings using the rich text editor
6. Save as **Draft** or **Finalize** the report

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Register new user (Admin only)
- `GET /api/auth/me` - Get current user

### Studies
- `GET /api/studies` - Fetch studies from Orthanc
- `GET /api/studies/:studyUid` - Get specific study details

### Reports
- `GET /api/reports` - Get all reports
- `GET /api/reports/:studyUid` - Get report for specific study
- `POST /api/reports` - Create new report
- `PUT /api/reports/:id` - Update report
- `DELETE /api/reports/:id` - Delete report (Admin only)

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (RBAC)
- Orthanc credentials stored server-side only
- CORS protection
- Input validation and sanitization

## Deployment

### Backend (Node.js)
- Deploy to: Railway, Render, Heroku, or VPS
- Set environment variables in production
- Use MongoDB Atlas for production database

### Frontend (Next.js)
- Deploy to: Vercel (recommended), Netlify, or any Node.js hosting
- Set `NEXT_PUBLIC_API_URL` to your production backend URL

## Troubleshooting

### CORS Issues
Make sure the backend CORS configuration includes your frontend URL.

### Orthanc Connection Failed
- Verify `ORTHANC_URL`, `ORTHANC_USERNAME`, and `ORTHANC_PASSWORD` in backend `.env`
- Test Orthanc access: `curl -u username:password https://pacs.58wilaya.com/system`

### MongoDB Connection Error
- Ensure MongoDB is running: `mongod`
- Or use MongoDB Atlas cloud database

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues or questions, please create an issue in the repository.
