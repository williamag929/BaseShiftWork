# Stage 1: Build the Angular application
FROM node:18 as build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN npm run build -- --configuration production

# Stage 2: Serve the application from a lightweight web server
FROM nginx:alpine

COPY --from=build /app/dist/ShiftWorkFrontend /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
