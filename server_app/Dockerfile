# Используем базовый образ с Node.js
FROM node:18

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем package.json и package-lock.json для установки зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем весь проект в контейнер
COPY . .

# Сборка TypeScript в JavaScript
RUN npm run build

# Указываем переменные окружения
ENV NODE_ENV=production

# Указываем порт, который будет использовать приложение
EXPOSE ${PORT:-8080}

# Указываем команду для запуска приложения
CMD ["npm", "run", "start"]