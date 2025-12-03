# ShiftWork Mobile - Dockerfile
# For building and serving the Expo web version or running development server

# Use Node.js 18 LTS (Alpine for smaller image size)
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies required by Expo
RUN apk add --no-cache \
    git \
    bash

# Install Expo CLI globally
RUN npm install -g expo-cli@latest

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy application code
COPY . .

# Expose Expo dev server ports
# 8081 - Metro bundler
# 19000 - Expo DevTools
# 19001 - Expo DevTools (WebSocket)
# 19002 - Expo DevTools (ngrok)
EXPOSE 8081 19000 19001 19002

# Create .env file placeholder (should be mounted or passed as build args)
RUN touch .env

# Set environment to development by default
ENV NODE_ENV=development

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:19000', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Default command - start Expo dev server
CMD ["npm", "start"]
