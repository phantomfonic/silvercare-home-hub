FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install --workspace=@silvercare/api --include-workspace-root

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/api apps/api
COPY migrations migrations
RUN npm run build -w @silvercare/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY migrations ./migrations
EXPOSE 8787
CMD ["node", "dist/index.js"]
