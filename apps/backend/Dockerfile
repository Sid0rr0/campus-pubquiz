# Build context must be the monorepo root (not apps/backend) so this stage
# can see pnpm-workspace.yaml and the shared/types workspace package that
# @campus-pubquiz/types (a "workspace:*" dependency) resolves to.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY shared/types/package.json shared/types/package.json
RUN pnpm install --frozen-lockfile

COPY shared/types shared/types
COPY apps/backend apps/backend
RUN pnpm --filter @campus-pubquiz/types build
RUN pnpm --filter backend build

FROM base AS runner
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY shared/types/package.json shared/types/package.json
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/shared/types/dist shared/types/dist
COPY --from=build /app/apps/backend/dist apps/backend/dist

WORKDIR /app/apps/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]
