# 📚 RIS Documentation Index

Complete documentation reference for the Radiology Information System.

---

## 🚀 Getting Started

**New to the project? Start here:**

1. **[README.md](README.md)** - Project overview and main entry point
2. **[QUICKSTART.md](QUICKSTART.md)** ⭐ - Get up and running in 10 minutes
3. **[Backend Setup](backend/README.md)** - Detailed backend installation
4. **[Frontend Setup](frontend/README.md)** - Detailed frontend installation

---

## 📖 Core Documentation

### Architecture & Design

| Document | Description | When to Read |
|----------|-------------|--------------|
| **[STRUCTURE.md](STRUCTURE.md)** | Complete project architecture, file organization, database schemas | Understanding how the system works |
| **[VISUAL_GUIDE.md](VISUAL_GUIDE.md)** | UI/UX walkthrough with page descriptions | Designing or modifying the interface |
| **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** | Feature list and capabilities overview | Presenting the project or planning features |

### Setup & Deployment

| Document | Description | When to Read |
|----------|-------------|--------------|
| **[QUICKSTART.md](QUICKSTART.md)** ⭐ | Fast setup guide (10 minutes) | First-time setup, quick demo |
| **[backend/README.md](backend/README.md)** | Backend detailed setup, API docs | Setting up backend, API integration |
| **[frontend/README.md](frontend/README.md)** | Frontend detailed setup, configuration | Setting up frontend, UI customization |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Production deployment guide | Going live, cloud hosting |

### Troubleshooting

| Document | Description | When to Read |
|----------|-------------|--------------|
| **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** | Common issues and solutions | When something doesn't work |

---

## 🗂️ Documentation by Role

### For Developers

**First time setting up:**
1. [QUICKSTART.md](QUICKSTART.md) - Quick setup
2. [backend/README.md](backend/README.md) - Backend details
3. [frontend/README.md](frontend/README.md) - Frontend details

**Understanding the codebase:**
1. [STRUCTURE.md](STRUCTURE.md) - Architecture
2. [Backend code](backend/src/) - API implementation
3. [Frontend code](frontend/src/) - UI implementation

**When issues arise:**
1. [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common problems

### For DevOps / System Admins

**Setting up infrastructure:**
1. [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
2. [backend/README.md](backend/README.md#production-deployment) - Backend hosting
3. [frontend/README.md](frontend/README.md#production-deployment) - Frontend hosting

**Monitoring & maintenance:**
1. [DEPLOYMENT.md](DEPLOYMENT.md#maintenance) - Maintenance tasks
2. [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues

### For Designers / UX

**Understanding the UI:**
1. [VISUAL_GUIDE.md](VISUAL_GUIDE.md) - Complete UI walkthrough
2. [Frontend components](frontend/src/components/) - Reusable components
3. [Tailwind config](frontend/tailwind.config.js) - Design tokens

### For Project Managers

**Project overview:**
1. [README.md](README.md) - Overview
2. [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Features & capabilities
3. [DEPLOYMENT.md](DEPLOYMENT.md#cost-estimate) - Cost estimates

**Planning:**
1. [STRUCTURE.md](STRUCTURE.md#potential-future-enhancements) - Future features

---

## 📝 Documentation by Task

### Task: First-Time Setup

**Documents needed:**
1. [QUICKSTART.md](QUICKSTART.md) - Main guide
2. [backend/.env.example](backend/.env.example) - Backend config template
3. [frontend/.env.local.example](frontend/.env.local.example) - Frontend config template

**Time required:** 10-15 minutes

---

### Task: Deploying to Production

**Documents needed:**
1. [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment guide
2. [backend/README.md](backend/README.md#production-deployment)
3. [frontend/README.md](frontend/README.md#production-deployment)

**Time required:** 1-2 hours (first time)

---

### Task: Adding New Features

**Documents needed:**
1. [STRUCTURE.md](STRUCTURE.md) - Understand current architecture
2. [backend/src/routes/](backend/src/routes/) - Backend API patterns
3. [frontend/src/app/](frontend/src/app/) - Frontend page structure

**Best practices:**
- Follow existing file naming conventions
- Use the same design patterns
- Update documentation when adding features

---

### Task: Troubleshooting Issues

**Documents needed:**
1. [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - First stop for issues
2. [backend/README.md](backend/README.md#troubleshooting) - Backend-specific
3. [frontend/README.md](frontend/README.md#troubleshooting) - Frontend-specific

**Debugging steps:**
1. Check relevant troubleshooting doc
2. Review error logs
3. Verify environment variables
4. Test components in isolation

---

### Task: Understanding Data Flow

**Documents needed:**
1. [STRUCTURE.md](STRUCTURE.md#data-flow) - Data flow diagrams
2. [backend/src/services/orthancService.js](backend/src/services/orthancService.js) - PACS integration
3. [frontend/src/lib/api.js](frontend/src/lib/api.js) - API client

---

### Task: Customizing UI

**Documents needed:**
1. [VISUAL_GUIDE.md](VISUAL_GUIDE.md) - Current UI design
2. [frontend/tailwind.config.js](frontend/tailwind.config.js) - Theme configuration
3. [frontend/src/app/globals.css](frontend/src/app/globals.css) - Global styles

**Customization points:**
- Colors: Edit `tailwind.config.js` → `theme.extend.colors`
- Typography: Change font in `frontend/src/app/layout.js`
- Layout: Modify components in `frontend/src/components/`

---

## 🔍 Quick Reference

### Environment Variables

**Backend** (in `backend/.env`):
```
PORT, MONGODB_URI, JWT_SECRET, NODE_ENV
ORTHANC_URL, ORTHANC_USERNAME, ORTHANC_PASSWORD
FRONTEND_URL
```
📖 See: [backend/.env.example](backend/.env.example)

**Frontend** (in `frontend/.env.local`):
```
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_ORTHANC_URL
```
📖 See: [frontend/.env.local.example](frontend/.env.local.example)

### Default Credentials

```
Email: admin@ris.com
Password: admin123
```
⚠️ Change after first login!

### Port Configuration

```
Backend:  http://localhost:5000
Frontend: http://localhost:3000
MongoDB:  mongodb://localhost:27017
```

### API Endpoints

See: [STRUCTURE.md](STRUCTURE.md#api-endpoints)

### Database Schema

See: [STRUCTURE.md](STRUCTURE.md#database-schema)

---

## 📦 File Inventory

### Documentation Files (10)

```
✅ README.md              - Main entry point
✅ QUICKSTART.md          - Quick setup guide
✅ DEPLOYMENT.md          - Production deployment
✅ STRUCTURE.md           - Architecture details
✅ PROJECT_SUMMARY.md     - Feature overview
✅ VISUAL_GUIDE.md        - UI walkthrough
✅ TROUBLESHOOTING.md     - Issue resolution
✅ INDEX.md              - This file
✅ LICENSE               - MIT License
✅ .gitignore            - Git ignore rules
```

### Backend Files (12)

```
backend/
├── src/
│   ├── server.js
│   ├── models/ (2 files)
│   ├── routes/ (4 files)
│   ├── middleware/ (1 file)
│   └── services/ (1 file)
├── package.json
├── .env.example
└── README.md
```

### Frontend Files (19)

```
frontend/
├── src/
│   ├── app/ (9 files)
│   ├── components/ (2 files)
│   └── lib/ (2 files)
├── package.json
├── .env.local.example
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── .eslintrc.json
└── README.md
```

**Total: 41 files** 📁

---

## 🎓 Learning Path

### Beginner Path

1. Read [README.md](README.md)
2. Follow [QUICKSTART.md](QUICKSTART.md)
3. Explore the running app
4. Read [VISUAL_GUIDE.md](VISUAL_GUIDE.md)

### Intermediate Path

1. Complete Beginner Path
2. Read [STRUCTURE.md](STRUCTURE.md)
3. Explore backend code ([backend/src/](backend/src/))
4. Explore frontend code ([frontend/src/](frontend/src/))
5. Read [backend/README.md](backend/README.md)
6. Read [frontend/README.md](frontend/README.md)

### Advanced Path

1. Complete Intermediate Path
2. Read [DEPLOYMENT.md](DEPLOYMENT.md)
3. Set up production environment
4. Implement custom features
5. Contribute improvements

---

## 🔄 Documentation Updates

When making changes to the system:

### Added New Feature?
- [ ] Update [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)
- [ ] Update [STRUCTURE.md](STRUCTURE.md) if architecture changed
- [ ] Update [VISUAL_GUIDE.md](VISUAL_GUIDE.md) if UI changed
- [ ] Update relevant README files

### Changed Configuration?
- [ ] Update `.env.example` files
- [ ] Update [QUICKSTART.md](QUICKSTART.md) if setup process changed
- [ ] Update [DEPLOYMENT.md](DEPLOYMENT.md) if deployment changed

### Fixed a Bug?
- [ ] Add solution to [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- [ ] Update relevant README if it was a common issue

---

## 📞 Support

**Need help?**

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review error logs
3. Search documentation using your code editor
4. Check GitHub issues (if applicable)

---

## 🎯 Quick Navigation

- **Home**: [README.md](README.md)
- **Setup**: [QUICKSTART.md](QUICKSTART.md)
- **Deploy**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Architecture**: [STRUCTURE.md](STRUCTURE.md)
- **Features**: [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)
- **UI Design**: [VISUAL_GUIDE.md](VISUAL_GUIDE.md)
- **Help**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

**Last Updated**: November 22, 2025

**Documentation Version**: 1.0.0

---

*This documentation is maintained alongside the codebase. Keep it updated!* 📝
