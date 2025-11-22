# Frontend Setup Instructions

## Prerequisites

- Node.js 18+ installed
- Backend server running (see backend/README.md)

## Installation Steps

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your actual values:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_ORTHANC_URL=https://pacs.58wilaya.com
```

**Configuration Notes:**

- **NEXT_PUBLIC_API_URL**: URL of your backend API
  - Development: `http://localhost:5000/api`
  - Production: `https://your-backend-domain.com/api`

- **NEXT_PUBLIC_ORTHANC_URL**: URL of your Orthanc PACS server
  - Should match the ORTHANC_URL in backend

### 3. Run the Development Server

```bash
npm run dev
```

The app will start on http://localhost:3000

### 4. Build for Production

```bash
npm run build
npm start
```

## First Login

1. Navigate to http://localhost:3000
2. You'll be redirected to the login page
3. Use default credentials:
   - **Email**: admin@ris.com
   - **Password**: admin123

⚠️ **Change this password immediately** in production!

## Features Overview

### For Administrators

1. **User Management** (`/dashboard/users`)
   - Create new users (Radiologists, Admins)
   - Edit user details and roles
   - Activate/deactivate users
   - Delete users

### For Radiologists

1. **Worklist** (`/dashboard`)
   - View all patient studies from PACS
   - Search by patient name, ID, or date range
   - See report status (Unreported, Draft, Final)
   - Quick access to reporting interface

2. **Reporting Interface** (`/dashboard/report/[studyUid]`)
   - **Left Panel**: OHIF DICOM Viewer showing images
   - **Right Panel**: Rich text editor for writing reports
   - Save reports as drafts or finalize them
   - Auto-generated report template

3. **Reports** (`/dashboard/reports`)
   - View all reports
   - Filter by status (Draft/Final)
   - Quick access to edit reports

## Troubleshooting

### "Network Error" or "Failed to fetch"

**Problem**: Frontend cannot connect to backend

**Solution**:
1. Verify backend is running on port 5000
2. Check `NEXT_PUBLIC_API_URL` in `.env.local`
3. Check browser console for CORS errors
4. Verify backend CORS settings allow frontend URL

### OHIF Viewer Not Loading

**Problem**: Iframe shows blank or error

**Solution**:
1. Verify `NEXT_PUBLIC_ORTHANC_URL` is correct
2. Check Orthanc server is accessible
3. Ensure OHIF plugin is installed in Orthanc
4. Test URL directly: `https://pacs.58wilaya.com/ohif/viewer?StudyInstanceUIDs=<study_uid>`

### "Unauthorized" or Redirected to Login

**Problem**: Session expired or invalid token

**Solution**:
1. Login again
2. Check if backend is running
3. Clear browser localStorage and try again

### Styles Not Loading

**Problem**: Page appears unstyled

**Solution**:
1. Ensure Tailwind CSS is properly configured
2. Run `npm install` again
3. Delete `.next` folder and restart dev server

## Production Deployment

### Recommended: Vercel (Easiest for Next.js)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Set environment variables:
     - `NEXT_PUBLIC_API_URL` → Your production backend URL
     - `NEXT_PUBLIC_ORTHANC_URL` → Your Orthanc server URL
   - Deploy!

### Alternative: Netlify

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy the `.next` folder to Netlify

3. Set environment variables in Netlify dashboard

### Alternative: VPS/Custom Server

1. Build for production:
   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start npm --name "ris-frontend" -- start
   pm2 save
   pm2 startup
   ```

4. Set up Nginx as reverse proxy:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Environment Variables for Production

Set these in your hosting platform:

```env
NEXT_PUBLIC_API_URL=https://your-backend-api.com/api
NEXT_PUBLIC_ORTHANC_URL=https://pacs.58wilaya.com
```

## Browser Compatibility

Tested and supported on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Performance Tips

1. **Images**: The OHIF viewer handles DICOM images efficiently
2. **Caching**: Next.js automatically caches static assets
3. **Lazy Loading**: Reports and studies load on-demand
4. **Code Splitting**: Next.js automatically splits code by route

## Security Notes

- All API calls require JWT authentication
- Tokens are stored in localStorage
- HTTPS is required for production
- Orthanc credentials never exposed to frontend
- CORS configured to allow only specific origins
