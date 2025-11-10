# ShiftWork Mobile - Setup Guide

## Initial Setup Steps

Follow these steps to get the mobile app running:

### Option A: Local Development (Recommended for Development)

#### 1. Install Dependencies

```powershell
cd ShiftWork.Mobile
npm install
```

### 2. Configure Environment Variables

```powershell
# Copy the example file
cp .env.example .env

# Edit .env with your actual values
# You'll need:
# - Backend API URL (from ShiftWork.Api)
# - Firebase credentials (from Firebase Console)
# - AWS S3 bucket info (for photo uploads)
```

### 3. Start Development Server

```powershell
npm start
```

This will open Expo DevTools in your browser.

### 4. Run on Device/Emulator

**Option A: Physical Device (Easiest)**
1. Install "Expo Go" app from App Store (iOS) or Play Store (Android)
2. Scan the QR code from the terminal
3. App will load on your device

**Option B: iOS Simulator (macOS only)**
```powershell
npm run ios
```

**Option C: Android Emulator**
1. Start Android emulator from Android Studio
2. Run:
```powershell
npm run android
```

### Option B: Docker Development

#### 1. Build and Run with Docker Compose

```powershell
# Make sure you have .env file configured
cp .env.example .env
# Edit .env with your values

# Start the development server
docker-compose up mobile-dev

# Or run in detached mode
docker-compose up -d mobile-dev

# View logs
docker-compose logs -f mobile-dev

# Stop containers
docker-compose down
```

#### 2. Access the App

Once running, the Expo DevTools will be available at:
- DevTools: http://localhost:19000
- Metro bundler: http://localhost:8081

You can still scan the QR code with Expo Go app on your phone.

#### 3. Docker Production Web Build

To build and serve the web version:

```powershell
# Build and run production web version
docker-compose --profile production up mobile-web

# Or build separately
docker build -t shiftwork-mobile-web -f Dockerfile.prod .

# Run with environment variables
docker run -p 3000:80 \
  -e API_URL=https://api.shiftwork.com \
  -e FIREBASE_API_KEY=your-key \
  -e FIREBASE_AUTH_DOMAIN=your-domain \
  -e FIREBASE_PROJECT_ID=your-project \
  shiftwork-mobile-web
```

The web app will be available at http://localhost:3000

## Backend Setup

The mobile app requires the ShiftWork.Api backend to be running:

```powershell
# In a separate terminal, navigate to the API project
cd ..\ShiftWork.Api

# Set environment variables
$env:DB_CONNECTION_STRING = "Server=localhost;Database=ShiftWork;..."
$env:FIREBASE_PROJECT_ID = "your-project"
$env:FIREBASE_AUTH_DOMAIN = "your-project.firebaseapp.com"
$env:FIREBASE_API_KEY = "your-firebase-web-api-key"

# Run the API
dotnet run
```

Note the API URL (usually `https://localhost:5001`) and use it in your mobile `.env` file.

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Email/Password** authentication
4. Go to Project Settings → General
5. Add a Web app
6. Copy the configuration values to your `.env` file

## First Run Checklist

- [ ] Backend API is running
- [ ] Firebase project is configured
- [ ] `.env` file has all required values
- [ ] Dependencies installed (`npm install`)
- [ ] Expo Go app installed on phone (if using physical device)
- [ ] Development server started (`npm start`)

## Docker Commands Reference

### Development Container

```powershell
# Start development server
docker-compose up mobile-dev

# Rebuild after package.json changes
docker-compose build mobile-dev
docker-compose up mobile-dev

# Run commands inside container
docker-compose exec mobile-dev npm install <package>
docker-compose exec mobile-dev npm run lint

# Shell access
docker-compose exec mobile-dev sh
```

### Production Container

```powershell
# Build production image
docker build -t shiftwork-mobile-web:latest -f Dockerfile.prod \
  --build-arg API_URL=https://api.shiftwork.com \
  --build-arg FIREBASE_API_KEY=your-key \
  .

# Run production container
docker run -d -p 3000:80 --name shiftwork-mobile shiftwork-mobile-web:latest

# View logs
docker logs -f shiftwork-mobile

# Stop and remove
docker stop shiftwork-mobile
docker rm shiftwork-mobile
```

## Troubleshooting

### Docker-specific Issues

**"Port already in use"**
```powershell
# Check what's using the port
netstat -ano | findstr :8081

# Stop other containers
docker-compose down

# Use different ports
docker-compose -f docker-compose.yml -f docker-compose.override.yml up
```

**"node_modules volume issues"**
```powershell
# Remove and rebuild
docker-compose down -v
docker-compose build --no-cache mobile-dev
docker-compose up mobile-dev
```

**"Cannot reach backend from container"**
- Use host.docker.internal instead of localhost in API_URL
- Example: `API_URL=http://host.docker.internal:5001`
- Or connect to the same Docker network as the backend

### "Cannot connect to backend"
- Check that API_URL in `.env` matches your running backend
- If using localhost, you may need to use your computer's IP address instead
- Example: `API_URL=http://192.168.1.100:5001` (replace with your IP)

### "Firebase auth error"
- Verify Firebase credentials in `.env`
- Ensure Email/Password auth is enabled in Firebase Console
- Check that FIREBASE_PROJECT_ID matches your project

### "Module not found"
- Run `npm install` again
- Clear cache: `expo start -c`

### "Port already in use"
- Kill the process using port 8081
- Or start on different port: `expo start --port 8082`

## Next Steps

After successful setup:

1. **Test login** - Try logging in with a test user
2. **Test clock in** - Clock in with photo/location
3. **View schedules** - Check schedule displays correctly
4. **Test dashboard** - Verify metrics are calculated

## Development Workflow

1. Make code changes
2. App will automatically reload (Fast Refresh)
3. Check terminal for errors
4. Test on device/simulator
5. Commit changes

## Building for Production

See [MOBILE_AGENT.md](./MOBILE_AGENT.md) for detailed build instructions using EAS.

Quick command:
```powershell
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure build
eas build:configure

# Build for iOS/Android
eas build --platform all --profile production
```

## Need Help?

- Check [MOBILE_AGENT.md](./MOBILE_AGENT.md) for detailed documentation
- Check [AGENT.md](../AGENT.md) for backend API documentation
- Review error messages in terminal
- Check Expo DevTools for network requests
