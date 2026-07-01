# ── Build ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Production English build.
# Angular outputs to dist/shift-workfrontend/en-US/ when localize is set.
RUN npx ng build --configuration=production

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy English locale output; adjust path if your angular.json outputPath differs
COPY --from=build /app/dist/shift-workfrontend/en-US /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
