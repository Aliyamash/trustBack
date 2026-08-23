FROM node:24-alpine

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY src ./src
COPY seed-assets ./seed-assets
RUN mkdir -p data uploads

EXPOSE 8000
CMD ["pnpm", "start"]
