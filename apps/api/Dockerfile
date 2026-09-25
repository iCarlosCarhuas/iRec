FROM node:24.15.0-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable \
  && corepack prepare pnpm@12.4.1 --activate

WORKDIR /workspace
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @irec/contracts build
RUN rm -rf apps/api/dist apps/api/tsconfig*.tsbuildinfo && pnpm --filter @irec/api build

WORKDIR /workspace/apps/api

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
