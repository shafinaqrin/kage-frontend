# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
ARG BACKEND_HOST=kage-backend
ARG BACKEND_PORT=3000
ENV BACKEND_HOST=${BACKEND_HOST}
ENV BACKEND_PORT=${BACKEND_PORT}
COPY package.json package-lock.json* ./
RUN npm ci --no-fund --no-audit || npm install --no-fund --no-audit
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=5173
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 5173
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:5173/ || exit 1
CMD ["node", "server.js"]
