# Multi-stage Dockerfile
FROM node:20.18.0 AS angular-build
WORKDIR /app/ShiftWork.Angular 

# Install Angular CLI globally
RUN npm install -g @angular/cli@19.0.0

# Copy Angular project and .env
COPY package.json package-lock.json ./
COPY .env ./
RUN npm install

COPY . ./
#RUN npm run build --prod
# Expose port 80
EXPOSE 4200

#CMD ["npm", "start"]
CMD ["ng", "serve", "--host", "0.0.0.0", "--disable-host-check"]

# .NET Build Stage  
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
# SET the working directory
WORKDIR /app/ShiftWork.Api
# copy the project files
COPY . .

# Restore and build the project
RUN dotnet restore
RUN dotnet publish -c Release -o out

# Final stage: run the application using ASP.NET Core runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app/ShiftWork.Api/out .

# Copy .NET .env file for runtime
COPY .env ./

# Copy Angular build output
COPY --from=angular-build /app/ShiftWork.Angular/dist ./wwwroot

#EXPOSE 80
#ENTRYPOINT ["dotnet", "YourApp.dll"]


# Expose port 80 for the application
EXPOSE 5182
# Set the application to listen on IPv4 only
ENV ASPNETCORE_URLS=http://0.0.0.0:5182
# Run the application
ENTRYPOINT ["dotnet", "ShiftWork.Api.dll"]