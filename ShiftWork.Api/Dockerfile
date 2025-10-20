# Stage 1: Build the application using the .NET SDK for Windows Server
#FROM mcr.microsoft.com/dotnet/sdk:9.0-windowsservercore-ltsc2022 AS build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
# SET the working directory
WORKDIR /app
# copy the project files
COPY . .
# Restore and build the project
RUN dotnet restore
RUN dotnet publish -c Release -o out

# Final stage: run the application using ASP.NET Core runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app/out .

# Copy .NET .env file for runtime
COPY .env ./

# Expose port 80 for the application
EXPOSE 80
# Set the application to listen on IPv4 only
ENV ASPNETCORE_URLS=http://0.0.0.0:80
# Run the application

ENTRYPOINT ["dotnet", "ShiftWork.Api.dll"]