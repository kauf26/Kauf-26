# =============================================================================
# Kauf26 API — production container
# Use with Render, Railway, Fly.io, or any Docker host.
# Marketing site (kaufai.com) stays on Vercel — API only on this image.
# =============================================================================
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/shared ./shared
EXPOSE 2626
# Render/Railway inject PORT; default 2626 for local docker run
CMD ["node", "dist/index.cjs"]
