# ShiftWork Project

ShiftWork is a full-stack workforce management application for time tracking and employee scheduling.

## 📚 Documentation

- **[Technical Overview](#1-project-description)** - This file
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to the project
- **[GitHub MCP Guide](./GITHUB_MCP_GUIDE.md)** - GitHub MCP integration and best practices
- **[GitHub Issues Guide](./GITHUB_ISSUES_GUIDE.md)** - How to create and manage issues effectively
- **[Agent Guide](./AGENT.md)** - Complete guide for AI agents and developers
- **[Mobile App Guide](./ShiftWork.Mobile/README.md)** - Mobile development setup
- **[MCP Server Architecture](./python_client/MCP_SERVER.md)** - Python MCP server details

---

## Technical Overview

This document provides a technical overview of the ShiftWork project, intended for developers and AI agents.

## 1. Project Description

ShiftWork is a full-stack web application designed for time tracking and employee management on job sites. It allows employees to clock in and out, and it captures time, geolocation data, and a photo for verification. The primary target industries are construction and hospitality (restaurants), but it is adaptable for other sectors requiring similar functionality.

## 2. System Architecture

The application is built with a modern web architecture, consisting of multiple frontend applications and a RESTful API backend.

*   **Web Frontend:** Angular (TypeScript) - Admin/kiosk interface
*   **Mobile App:** React Native with Expo (TypeScript) - Employee mobile app
*   **Backend:** .NET Core Web API (C#)
*   **Database:** The backend uses Entity Framework Core with SQL Server/PostgreSQL. Migrations are managed with EF Core Migrations.
*   **Storage:** AWS S3 integration for storing user-uploaded photos (profile pictures, clock-in photos)
*   **Authentication:** Firebase Authentication for mobile, token-based auth for web

---

## 3. Backend (.NET Core API)

The backend is located in the `ShiftWork.Api/` directory.

*   **Framework:** .NET Core
*   **Language:** C#
*   **Project File:** `ShiftWork.Api.csproj`
*   **Entry Point:** `Program.cs`

### Key Backend Directories:

*   `Controllers/`: Contains API controllers that handle incoming HTTP requests. Each controller corresponds to a specific domain entity (e.g., `PeopleController`, `SchedulesController`).
*   `Services/`: Contains the business logic, separating it from the controllers. Services are injected into controllers via dependency injection.
*   `Models/`: Defines the core domain entities (e.g., `Person`, `Schedule`, `ShiftEvent`).
*   `DTOs/`: Data Transfer Objects used to shape the data sent to and from the API endpoints. This prevents exposing the internal database models directly.
*   `Data/`: Contains the Entity Framework `DbContext` (`ShiftWorkContext.cs`) and database-related configurations.
*   `Migrations/`: Contains EF Core database migration files, tracking changes to the database schema over time.
*   `Helpers/`: Utility classes, such as AutoMapper profiles (`MappingProfiles.cs`) for mapping between Models and DTOs.

### Backend Features:

*   **RESTful API:** Exposes endpoints for all CRUD (Create, Read, Update, Delete) operations on the main entities.
*   **Authentication:** `AuthController.cs` suggests a token-based authentication system.
*   **Entity Management:** Full management of Companies, Users, People, Roles, Schedules, Shifts, and more.
*   **AWS S3 Integration:** `AwsS3Service.cs` and `AwsS3BucketController.cs` handle file uploads, likely for employee photos.

---

## 4. Frontend (Angular)

The frontend is located in the `ShiftWork.Angular/` directory.

*   **Framework:** Angular
*   **Language:** TypeScript
*   **Package Manager:** npm

### Key Frontend Files & Directories:

*   `src/app/`: The main application source code.
*   `src/app/core/`: Core services, guards, and interceptors.
*   `src/app/features/`: Contains different feature modules of the application.
*   `src/app/shared/`: Shared components, directives, and pipes.
*   `src/app/store/`: Likely contains state management logic (e.g., NgRx).
*   `src/app/app-routing.module.ts`: Defines the application's routes.
*   `angular.json`: Angular CLI configuration file.
*   `package.json`: Lists project dependencies and scripts.
*   `custom-webpack.config.ts`: Indicates a customized webpack build process.

### Frontend Features:

*   **Component-Based:** Built using Angular's component architecture.
*   **Routing:** Uses Angular Router for navigation between different views.
*   **State Management:** The presence of a `store` directory suggests a centralized state management pattern.
*   **Theming:** Uses SCSS for styling, with a custom theme defined.

---

## 5. Mobile Application (React Native + Expo)

The mobile app is located in the `ShiftWork.Mobile/` directory.

*   **Framework:** React Native with Expo SDK 50
*   **Language:** TypeScript
*   **Routing:** Expo Router (file-based)
*   **State Management:** Zustand

### Key Mobile Features:

*   **Personal Clock In/Out:** Employees can clock in/out with photo capture and GPS tracking from their personal device
*   **Weekly Schedule View:** View published shifts in a 7-day calendar grid with total hours calculation
*   **Dashboard:** Display shift stats, upcoming shifts, and time off requests
*   **Time Off Requests:** Submit and view time off requests with PTO balance tracking
*   **Profile Management:** Update personal information and change PIN
*   **Push Notifications:** Real-time updates for schedule changes, shift assignments, and time off approvals
*   **Biometric Authentication:** Face ID/Fingerprint login support for quick access
*   **Real-time Updates:** Automatic refresh with polling and app state monitoring
*   **Photo Uploads:** S3 integration for shift photos with Firebase auth

### Mobile Tech Stack:

*   React Native 0.73
*   Expo SDK 50 (expo-camera, expo-location, expo-notifications, expo-local-authentication)
*   TypeScript
*   Zustand (state management)
*   Axios (API client)
*   Firebase Authentication
*   AWS S3 (photo storage)

### Mobile Documentation:

*   **[ShiftWork.Mobile/README.md](./ShiftWork.Mobile/README.md)** - Setup and development guide
*   **[ShiftWork.Mobile/MOBILE_AGENT.md](./ShiftWork.Mobile/MOBILE_AGENT.md)** - Complete agent guide
*   **[ShiftWork.Mobile/BIOMETRIC_AUTH.md](./ShiftWork.Mobile/BIOMETRIC_AUTH.md)** - Biometric implementation details
*   **[MOBILE_FEATURES_SUMMARY.md](./MOBILE_FEATURES_SUMMARY.md)** - Feature implementation summary
*   **[PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md)** - Push notification setup

---

## 6. Kiosk Module Features

The application includes a kiosk mode with the following features:

*   **PIN Verification:** Employees must enter a 4-digit PIN to clock in or out, preventing users from clocking in as someone else. PINs are securely stored using BCrypt hashing. Administrators can set and update PINs on the employee management page.

*   **Photo Capture:** A photo is automatically taken via webcam during clock-in and clock-out events. This photo is uploaded to a configured AWS S3 bucket, and the URL is stored with the corresponding shift event for verification.

*   **Geolocation Tracking:** The browser's Geolocation API is used to capture the precise coordinates of the kiosk device during clock-in and clock-out. This data is saved with the shift event.

*   **Custom Clock-Out Questions:** Administrators can configure custom questions (e.g., "Did you get injured today?") that are presented to employees when they clock out. The answers are saved to the database for reporting and compliance.

*   **Unique Kiosk Identifier:** Each kiosk device is assigned a unique identifier, which is stored in the browser's local storage. This allows for tracking which device was used for each shift event.

---

## 7. Personal Clock-in/out

In addition to the kiosk mode, the application provides personal clock-in/out features for individual users through both the web dashboard and mobile app. This feature is accessible from the user's dashboard and provides the same functionality as the kiosk mode, but for the currently logged-in user.

*   **Personal Time Tracking:** Allows individual users to clock in, clock out, and manage breaks from their own device (phone or web browser).
*   **Automatic Project/Location Selection:** The system automatically selects the project or location based on the user's schedule for the day. If no schedule is set, the user can select it manually.
*   **Photo and Geolocation:** Captures a photo and the device's geolocation for each clock-in/out event to ensure the user is at the correct location.
*   **Custom Questions:** Presents the same custom clock-out questions as the kiosk mode.

---

## 8. Python Client

The `python_client/` directory contains various Python scripts. These scripts appear to be for testing the backend API or for other utility purposes. It includes MCP (Mission Critical Protocol) clients and servers, which might be for a specialized testing scenario or a legacy part of the project. This part of the codebase seems separate from the main Angular/.NET application.

---

## 9. How to Run

### Backend

1.  Navigate to `ShiftWork.Api/`.
2.  Restore dependencies: `dotnet restore`
3.  Run the application: `dotnet run`

### Web Frontend (Angular)

1.  Navigate to `ShiftWork.Angular/`.
2.  Install dependencies: `npm install`
3.  Run the development server: `npm start`

### Mobile App (React Native)

1.  Navigate to `ShiftWork.Mobile/`.
2.  Install dependencies: `npm install`
3.  Copy `.env.example` to `.env` and configure
4.  Start Expo dev server: `npm start`
5.  Run on iOS: `npm run ios` (requires macOS and Xcode)
6.  Run on Android: `npm run android` (requires Android Studio)
7.  Scan QR code with Expo Go app on physical device

See [ShiftWork.Mobile/README.md](./ShiftWork.Mobile/README.md) for detailed mobile setup instructions.
