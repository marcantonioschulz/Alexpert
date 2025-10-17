# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json tsconfig.node.json vite.config.ts ./
COPY index.html ./
COPY src ./src

EXPOSE 3000
COPY .env .
RUN npm run build && npm install -g serve
CMD ["serve", "-s", "dist", "-l", "3000"]
