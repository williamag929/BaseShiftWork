# ── Build ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build each locale into its own output dir. Angular places the compiled app in a
# subfolder named after the locale, with a per-locale base href:
#   en-US  → dist/build-en/en-US/   base href "/en-US/"  (default)
#   es-SP  → dist/build-es/es-SP/   base href "/es/"     (angular.json es-SP config)
RUN npx ng build --configuration=production --output-path=dist/build-en
RUN npx ng build --configuration=production,es-SP --output-path=dist/build-es

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Serve each locale under a path that matches its base href.
COPY --from=build /app/dist/build-en/en-US /usr/share/nginx/html/en-US
COPY --from=build /app/dist/build-es/es-SP /usr/share/nginx/html/es

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/en-US/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
