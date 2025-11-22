# Backend Setup Instructions

## Prerequisites

- Node.js 18+ installed
- MongoDB installed locally OR MongoDB Atlas account
- Access credentials for Orthanc PACS server

## Installation Steps

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` file with your actual values:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ris_db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development

# Orthanc PACS Configuration
ORTHANC_URL=https://pacs.58wilaya.com
ORTHANC_USERNAME=your_orthanc_username
ORTHANC_PASSWORD=your_orthanc_password

# CORS - Frontend URL
FRONTEND_URL=http://localhost:3000
```

**Important Configuration Notes:**

- **MONGODB_URI**: 
  - Local MongoDB: `mongodb://localhost:27017/ris_db`
  - MongoDB Atlas: Get connection string from Atlas dashboard
  
- **JWT_SECRET**: Generate a secure random string (at least 32 characters)
  ```bash
  # Generate on Linux/Mac:
  openssl rand -base64 32
  
  # Or use online generator: https://randomkeygen.com/
  ```

- **ORTHANC_URL**: Your Orthanc server URL (already set to pacs.58wilaya.com)

- **ORTHANC_USERNAME & ORTHANC_PASSWORD**: 
  - Get these from your Orthanc configuration
  - Check Orthanc's `orthanc.json` file for credentials

### 3. Start MongoDB (if using local)

```bash
# On Windows (as Administrator):
net start MongoDB

# On Linux:
sudo systemctl start mongod

# On macOS:
brew services start mongodb-community
```

### 4. Run the Backend Server

Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on http://localhost:5000

### 5. Verify Installation

Test the backend is running:
```bash
curl http://localhost:5000/health
```

You should see:
```json
{
  "status": "ok",
  "message": "RIS Backend is running",
  "timestamp": "2025-11-22T..."
}
```

### 6. Test Orthanc Connection

```bash
curl http://localhost:5000/api/studies/test/connection -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Default Admin Account

On first run, a default admin account is automatically created:

- **Email**: admin@ris.com
- **Password**: admin123

⚠️ **IMPORTANT**: Change this password immediately after first login!

## Troubleshooting

### MongoDB Connection Failed

**Error**: `MongoServerError: connection refused`

**Solution**:
1. Check MongoDB is running: `mongod --version`
2. Start MongoDB service
3. Verify connection string in `.env`

### Orthanc Connection Failed

**Error**: `401 Unauthorized` or `ECONNREFUSED`

**Solution**:
1. Verify `ORTHANC_URL` is correct
2. Check username/password in `.env`
3. Test Orthanc manually:
   ```bash
   curl -u username:password https://pacs.58wilaya.com/system
   ```
4. Ensure Orthanc allows connections from your backend server

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::5000`

**Solution**:
1. Change PORT in `.env` to another port (e.g., 5001)
2. Or kill the process using port 5000:
   ```bash
   # Windows:
   netstat -ano | findstr :5000
   taskkill /PID <PID> /F
   
   # Linux/Mac:
   lsof -ti:5000 | xargs kill
   ```

## API Documentation

Once running, the backend exposes these endpoints:

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Studies
- `GET /api/studies` - List studies from PACS
- `GET /api/studies/:studyUid` - Get study details
- `GET /api/studies/test/connection` - Test PACS connection

### Reports
- `GET /api/reports` - List all reports
- `GET /api/reports/study/:studyUid` - Get report for study
- `POST /api/reports` - Create report
- `PUT /api/reports/:id` - Update report
- `DELETE /api/reports/:id` - Delete report (admin only)

### Users (Admin only)
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## Production Deployment

### Recommended Platforms

1. **Railway** (Easiest)
   - Push to GitHub
   - Connect repository to Railway
   - Add environment variables
   - Deploy

2. **Render**
   - Free tier available
   - Automatic deployments from Git
   - Built-in MongoDB option

3. **Heroku**
   - Add `Procfile`: `web: node src/server.js`
   - Set environment variables in dashboard

4. **VPS (DigitalOcean, AWS, etc.)**
   - Use PM2 for process management
   - Set up Nginx as reverse proxy
   - Enable HTTPS with Let's Encrypt

### Environment Variables for Production

Make sure to set these in your hosting platform:
- `MONGODB_URI` - Use MongoDB Atlas for production
- `JWT_SECRET` - Strong random string
- `NODE_ENV=production`
- `ORTHANC_URL`, `ORTHANC_USERNAME`, `ORTHANC_PASSWORD`
- `FRONTEND_URL` - Your production frontend URL

## Security Checklist

- [ ] Change default admin password
- [ ] Use strong JWT_SECRET
- [ ] Use MongoDB Atlas or secured MongoDB instance
- [ ] Enable HTTPS in production
- [ ] Keep Orthanc credentials secret
- [ ] Regular backups of MongoDB database
- [ ] Monitor server logs for suspicious activity
