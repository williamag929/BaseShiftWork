# Stage 1: Build the application using the .NET SDK for Windows Server
FROM mcr.microsoft.com/dotnet/sdk:9.0-windowsservercore-ltsc2022 AS build
WORKDIR /src

# Copy the solution and project files to restore packages
COPY ["ShiftWork.Api.sln", "."]
COPY ["ShiftWork.Api.csproj", "."]
RUN dotnet restore "./ShiftWork.Api.sln"

# Copy the rest of the source code
COPY . .

# Build and publish the application
RUN dotnet publish "./ShiftWork.Api.csproj" -c Release -o /app/publish

# Stage 2: Create the final runtime image using the ASP.NET runtime for Windows Server
FROM mcr.microsoft.com/dotnet/aspnet:9.0-windowsservercore-ltsc2022 AS final
WORKDIR /app

# Copy the published application from the build stage
COPY --from=build /app/publish .

# Expose the port the application runs on.
# The default for .NET applications in containers is 8080.
EXPOSE 8080

# Define the entry point for the container
ENTRYPOINT ["dotnet", "ShiftWork.Api.dll"]
