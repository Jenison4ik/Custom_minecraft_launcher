# syntax=docker/dockerfile:1
FROM node:22

WORKDIR /app

# Зависимости API и панели ставятся отдельными слоями.
# Пока не меняются package.json и lock-файлы, npm не запускается заново.
COPY package.json package-lock.json ./
COPY admin/package.json admin/package-lock.json admin/

RUN --mount=type=cache,target=/root/.npm \
    npm ci

RUN --mount=type=cache,target=/root/.npm \
    npm --prefix admin ci

COPY . .

RUN npm run build && npm --prefix admin run build

ENV NODE_ENV=production

EXPOSE ${PORT:-8080}

CMD ["npm", "run", "start"]
