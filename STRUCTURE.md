# RIS - Project Structure

## Complete Directory Tree

```
RIS/
│
├── README.md                    # Main project documentation
├── QUICKSTART.md               # Quick setup guide
├── DEPLOYMENT.md               # Production deployment guide
├── .gitignore                  # Git ignore rules
│
├── backend/                    # Express.js Backend
│   ├── src/
│   │   ├── config/            # Configuration files (future)
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT authentication middleware
│   │   ├── models/
│   │   │   ├── User.js        # User MongoDB schema
│   │   │   └── Report.js      # Report MongoDB schema
│   │   ├── routes/
│   │   │   ├── auth.js        # Auth endpoints (login, me, change-password)
│   │   │   ├── users.js       # User management (CRUD)
│   │   │   ├── studies.js     # PACS integration (fetch studies)
│   │   │   └── reports.js     # Report management (CRUD)
│   │   ├── services/
│   │   │   └── orthancService.js  # Orthanc API client
│   │   └── server.js          # Express app entry point
│   ├── .env.example           # Environment variables template
│   ├── package.json           # Dependencies and scripts
│   └── README.md              # Backend documentation
│
└── frontend/                  # Next.js Frontend
    ├── src/
    │   ├── app/               # Next.js 14 App Router
    │   │   ├── dashboard/
    │   │   │   ├── report/
    │   │   │   │   └── [studyUid]/
    │   │   │   │       └── page.js    # Reporting interface (split view)
    │   │   │   ├── reports/
    │   │   │   │   └── page.js        # Reports list page
    │   │   │   ├── users/
    │   │   │   │   └── page.js        # User management (admin)
    │   │   │   ├── layout.js          # Dashboard layout (auth wrapper)
    │   │   │   └── page.js            # Worklist page (main dashboard)
    │   │   ├── login/
    │   │   │   └── page.js            # Login page
    │   │   ├── globals.css            # Global styles & Tailwind
    │   │   ├── layout.js              # Root layout
    │   │   └── page.js                # Home (redirects to dashboard)
    │   ├── components/
    │   │   ├── Navbar.js              # Navigation bar
    │   │   └── RichTextEditor.js      # TipTap rich text editor
    │   └── lib/
    │       ├── api.js                 # Axios API client
    │       └── AuthContext.js         # React Context for auth
    ├── .env.local.example     # Frontend env variables template
    ├── next.config.js         # Next.js configuration
    ├── tailwind.config.js     # Tailwind CSS configuration
    ├── postcss.config.js      # PostCSS configuration
    ├── package.json           # Dependencies and scripts
    └── README.md              # Frontend documentation
```

## Key Files Description

### Backend

| File | Purpose |
|------|---------|
| `server.js` | Express app, MongoDB connection, routes setup, default admin seed |
| `models/User.js` | User schema (email, password, fullName, role, isActive) |
| `models/Report.js` | Report schema (studyInstanceUid, content, status, author) |
| `middleware/auth.js` | JWT verification, role-based access control |
| `routes/auth.js` | Login, get current user, change password |
| `routes/users.js` | User CRUD (admin only) |
| `routes/studies.js` | Fetch studies from Orthanc, merge with report status |
| `routes/reports.js` | Report CRUD, statistics |
| `services/orthancService.js` | Orthanc API wrapper (search, parse studies) |

### Frontend

| File | Purpose |
|------|---------|
| `app/layout.js` | Root layout with AuthProvider and Toaster |
| `app/login/page.js` | Login form |
| `app/dashboard/page.js` | Worklist with studies table and filters |
| `app/dashboard/layout.js` | Protected route wrapper (requires auth) |
| `app/dashboard/report/[studyUid]/page.js` | Split view: OHIF + Report editor |
| `app/dashboard/reports/page.js` | All reports list with filtering |
| `app/dashboard/users/page.js` | User management (admin only) |
| `components/Navbar.js` | Top navigation with user info and logout |
| `components/RichTextEditor.js` | TipTap WYSIWYG editor for reports |
| `lib/api.js` | Axios instance with auth interceptors |
| `lib/AuthContext.js` | Global auth state management |

## Database Schema

### Users Collection

```javascript
{
  _id: ObjectId,
  email: String (unique, required),
  password: String (hashed, required),
  fullName: String (required),
  role: Enum['ADMIN', 'RADIOLOGIST'],
  isActive: Boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Reports Collection

```javascript
{
  _id: ObjectId,
  studyInstanceUid: String (unique, required, indexed),
  patientName: String,
  patientId: String,
  studyDate: Date (indexed),
  modality: String,
  studyDescription: String,
  content: String (HTML),
  status: Enum['DRAFT', 'FINAL'] (indexed),
  authorId: ObjectId (ref: User),
  authorName: String,
  finalizedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get JWT
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Users (Admin Only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Studies
- `GET /api/studies` - Get studies from Orthanc (with filters)
- `GET /api/studies/:studyUid` - Get specific study
- `GET /api/studies/test/connection` - Test Orthanc connection

### Reports
- `GET /api/reports` - List all reports (with filters)
- `GET /api/reports/study/:studyUid` - Get report for study
- `POST /api/reports` - Create new report
- `PUT /api/reports/:id` - Update report
- `DELETE /api/reports/:id` - Delete report (admin only)
- `GET /api/reports/stats/overview` - Get statistics

## Environment Variables

### Backend (.env)

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ris_db
JWT_SECRET=your-secret-key
NODE_ENV=development
ORTHANC_URL=https://pacs.58wilaya.com
ORTHANC_USERNAME=your_username
ORTHANC_PASSWORD=your_password
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_ORTHANC_URL=https://pacs.58wilaya.com
```

## Technology Stack

### Backend
- **Framework**: Express.js 4.18
- **Database**: MongoDB + Mongoose 8.0
- **Auth**: JWT (jsonwebtoken 9.0)
- **Password**: bcryptjs 2.4
- **Validation**: express-validator 7.0
- **HTTP Client**: node-fetch 2.7
- **Security**: helmet, cors

### Frontend
- **Framework**: Next.js 14.2 (App Router)
- **UI**: React 18.3
- **Styling**: Tailwind CSS 3.4
- **Editor**: TipTap 2.1 (ProseMirror)
- **HTTP Client**: Axios 1.6
- **Notifications**: Sonner 1.3
- **Icons**: react-icons 5.0
- **Date**: date-fns 3.0

### External Services
- **PACS**: Orthanc (pacs.58wilaya.com)
- **Viewer**: OHIF Viewer (embedded via iframe)
- **Database**: MongoDB (local or Atlas)

## Development Scripts

### Backend
```bash
npm run dev     # Start with nodemon (auto-reload)
npm start       # Start production server
npm run seed    # Seed default admin (if needed)
```

### Frontend
```bash
npm run dev     # Start development server
npm run build   # Build for production
npm start       # Start production server
npm run lint    # Run ESLint
```

## Data Flow

### 1. Study Retrieval
```
User → Frontend → Backend /api/studies 
     → Orthanc API (/tools/find) 
     → Parse DICOM tags 
     → Check local reports DB 
     → Merge & return to Frontend
```

### 2. Report Creation
```
User writes report → Frontend 
     → POST /api/reports 
     → Validate & save to MongoDB 
     → Return report ID
```

### 3. OHIF Viewer
```
Frontend renders iframe 
     → Direct to Orthanc OHIF 
     → URL: /ohif/viewer?StudyInstanceUIDs=xxx
     → OHIF loads directly from Orthanc
```

### 4. Authentication
```
Login → POST /api/auth/login 
     → Verify credentials 
     → Generate JWT 
     → Frontend stores in localStorage 
     → All API calls include JWT in Authorization header
```

## Security Features

- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ Role-based access control (Admin, Radiologist)
- ✅ Orthanc credentials never exposed to frontend
- ✅ CORS protection
- ✅ Input validation on all endpoints
- ✅ MongoDB injection prevention (Mongoose)
- ✅ XSS protection (React escaping, helmet.js)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT License
