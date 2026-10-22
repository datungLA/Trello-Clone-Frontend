FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=256
ARG APP_URL=http://localhost:8080
ARG SITE_URL=http://localhost:8081
ENV NEXT_PUBLIC_APP_URL=$APP_URL
ENV SITE_URL=$SITE_URL
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
FROM nginx:1.28-alpine
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 80
