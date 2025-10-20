# ShiftWork Project Technical Overview

This document provides a technical overview of the ShiftWork project, intended for developers and AI agents.

## 1. Project Description

ShiftWork is a full-stack web application designed for time tracking and employee management on job sites. It allows employees to clock in and out, and it captures time, geolocation data, and a photo for verification. The primary target industries are construction and hospitality (restaurants), but it is adaptable for other sectors requiring similar functionality.

## 2. System Architecture

The application is built with a modern web architecture, consisting of a single-page application (SPA) frontend and a RESTful API backend.

*   **Frontend:** Angular (TypeScript)
*   **Backend:** .NET Core Web API (C#)
*   **Database:** The backend uses Entity Framework Core, suggesting a relational database like SQL Server, PostgreSQL, or SQLite. Migrations are managed with EF Core Migrations.
*   **Storage:** The system integrates with AWS S3 for storing user-uploaded photos (e.g., profile pictures or clock-in photos).

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

## 5. Python Client

The `python_client/` directory contains various Python scripts. These scripts appear to be for testing the backend API or for other utility purposes. It includes MCP (Mission Critical Protocol) clients and servers, which might be for a specialized testing scenario or a legacy part of the project. This part of the codebase seems separate from the main Angular/.NET application.

---

## 6. How to Run

### Backend

1.  Navigate to `ShiftWork.Api/`.
2.  Restore dependencies: `dotnet restore`
3.  Run the application: `dotnet run`

### Frontend

1.  Navigate to `ShiftWork.Angular/`.
2.  Install dependencies: `npm install`
3.  Run the development server: `npm start`
