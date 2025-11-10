# ShiftWork Mobile

Cross-platform mobile application for workforce scheduling and time tracking, built with React Native and Expo.

## Features

- ✅ Clock in/out with photo and GPS tracking
- 📅 View schedules (day, week, month)
- 📊 Dashboard with hours worked and upcoming shifts
- 📍 Location-based kiosk questions
- 🔐 Firebase authentication with PIN/biometric support
- 📱 iOS and Android support
- 🔄 Real-time sync with backend API

## Quick Start

### Local Development

```powershell
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Docker Development

```powershell
# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Start with Docker Compose
docker-compose up mobile-dev

# Access Expo DevTools at http://localhost:19000
```

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- iOS: macOS with Xcode
- Android: Android Studio with Android SDK

## Project Structure

```
ShiftWork.Mobile/
├── app/              # Expo Router screens
├── components/       # Reusable UI components
├── services/         # API service layer
├── hooks/            # Custom React hooks
├── store/            # State management (Zustand)
├── types/            # TypeScript definitions
├── utils/            # Utility functions
└── config/           # App configuration
```

## Environment Variables

Required environment variables (see `.env.example`):

- `API_URL` - Backend API URL
- `FIREBASE_API_KEY` - Firebase configuration
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

## Documentation

For detailed documentation, see:
- **[MOBILE_AGENT.md](./MOBILE_AGENT.md)** - Complete agent guide with API integration, architecture, and automation tasks
- **[AGENT.md](../AGENT.md)** - Main project documentation

## Tech Stack

- React Native 0.73
- Expo SDK 50
- TypeScript
- Expo Router (file-based routing)
- Zustand (state management)
- TanStack Query (data fetching)
- Axios (API client)
- Firebase Auth
- expo-camera, expo-location, expo-secure-store

## Scripts

- `npm start` - Start Expo dev server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run on web
- `npm run lint` - Lint code
- `npm run type-check` - TypeScript type checking

## Docker Commands

- `docker-compose up mobile-dev` - Start development server in Docker
- `docker-compose --profile production up mobile-web` - Build and serve production web version
- `docker-compose down` - Stop all containers
- `docker-compose logs -f mobile-dev` - View development logs

## Testing on Physical Device

1. Install **Expo Go** app on your phone
2. Run `npm start`
3. Scan QR code:
   - iOS: Use Camera app
   - Android: Use Expo Go app

## Building for Production

```powershell
# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run `npm run type-check` and `npm run lint`
4. Submit a pull request

## License

See [LICENSE](../LICENSE) file in root directory.

## Support

For issues or questions, refer to [MOBILE_AGENT.md](./MOBILE_AGENT.md) for detailed documentation.
