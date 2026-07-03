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
# Fail fast (with a clear message) if Vite ever leaks into the production bundle.
# This runs in Render's build logs and proves the shipped bundle is Vite-free.
RUN node -e "const s=require('fs').readFileSync('dist/index.cjs','utf8'); if(s.includes('require(\"vite\")')){console.error('FATAL: vite is bundled into dist/index.cjs'); process.exit(1);} console.log('OK: production bundle has no vite require');"

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
