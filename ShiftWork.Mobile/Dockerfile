# ShiftWork Mobile — Expo development server
FROM node:20-alpine
# Patch all CVEs that have available fixes in Alpine packages
RUN apk upgrade --no-cache && apk add --no-cache git

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Metro bundler port
EXPOSE 8081

RUN touch .env
ENV NODE_ENV=development

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8081/',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["npx", "expo", "start", "--tunnel"]
