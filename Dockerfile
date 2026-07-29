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

# Copy static assets required by the Next.js standalone server
RUN cp -r public .next/standalone/public \
    && mkdir -p .next/standalone/.next \
    && cp -r .next/static .next/standalone/.next/static

# Run
EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

CMD node .next/standalone/server.js

