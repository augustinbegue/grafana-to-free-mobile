FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

COPY --chown=bun:bun . .

ENV PORT=3000
EXPOSE 3000

USER bun
CMD ["bun", "run", "index.ts"]
