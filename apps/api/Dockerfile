# Build context is the repository root (see docker-compose.yml and render.yaml).
FROM node:20-alpine AS build
WORKDIR /repo
RUN apk add --no-cache git
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspaces --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @ripple/shared && npm run build --workspace @ripple/api

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN apk add --no-cache git && addgroup -S ripple && adduser -S ripple -G ripple
COPY --from=build /repo/package.json /repo/package-lock.json ./
COPY --from=build /repo/packages/shared/package.json packages/shared/
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/package.json apps/api/
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/drizzle apps/api/drizzle
RUN npm ci --omit=dev --workspaces --include-workspace-root
USER ripple
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/server.js"]
