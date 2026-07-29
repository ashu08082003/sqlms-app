FROM oven/bun:1.3.14 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile
RUN bun run db:generate

# Build
COPY . .
RUN bun run build

# Run
EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

CMD mkdir -p /app/db && bun run db:push && bun run scripts/seed.ts && bun run start
