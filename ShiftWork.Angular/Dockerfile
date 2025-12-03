# Stage 1: Build the Angular application
FROM node:20.18.0 AS build

# Install Angular CLI globally
RUN npm install -g @angular/cli@19.0.0

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

# Expose port 80
EXPOSE 4200

#CMD ["npm", "start"]
CMD ["ng", "serve", "--host", "0.0.0.0", "--disable-host-check"]


#RUN npm run build -- --configuration production

# Stage 2: Serve the application from a lightweight web server
#FROM nginx:alpine

#COPY --from=build /app/dist/shift-workfrontend /usr/share/nginx/html

#EXPOSE 80

#CMD ["nginx", "-g", "daemon off;"]
