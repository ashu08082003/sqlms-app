FROM oven/bun:1.3.14
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile && bun run db:generate

# Build application
COPY . .
RUN bun run build

# Copy static assets required by the Next.js standalone server
RUN cp -r public .next/standalone/public \
    && mkdir -p .next/standalone/.next \
    && cp -r .next/static .next/standalone/.next/static

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Push schema, seed DB (failures are non-fatal), then start the Next.js standalone server
CMD mkdir -p /app/db && bun run db:push; bun run scripts/seed.ts; node .next/standalone/server.js

