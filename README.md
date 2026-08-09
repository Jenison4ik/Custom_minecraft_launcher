# Custom Minecraft Launcher [CML]

![Stars](https://img.shields.io/github/stars/Jenison4ik/Custom_minecraft_launcher)
![License](https://img.shields.io/badge/license-MIT-green)

Лаунчер Minecraft для быстрого создания проектов с модами

❗ВАЖНО: На данный момент поддерживается только ядро Fabric

Поддержка Forge и Vanilla находится в разработке

## Принцип работы

- Вы указываете все необходимые настройки
- Собираете лаунчер согласно настройкам
- Запускаете сервер
- Готово!

## 🎮 Функциональность

- **Запуск Minecraft** с настраиваемыми параметрами
- **Автообновления лаунчера**
- **Проверка целостности игровых файлов и их востановлене** у клиента только последняя версия вашей сборки
- **Настройка RAM** для игры с учетом доступной памяти системы
- **Автоматическая установка Java 17** при необходимости
- **Сохранение настроек** в `config.json`
- **Современный UI** на React с TypeScript

## 🛠 Технологии

- **Electron** - для создания десктопного приложения
- **React** - для пользовательского интерфейса
- **TypeScript** - для типизации кода
- **Vite** - для сборки и разработки
- **Node.js** - для backend логики
- **Axios** - для загрузки файлов и работы с API

## 📦 Установка и сборка экземпляра лаунчера

### Предварительные требования

- [Node.js](https://nodejs.org/) (версия 16 или выше)
- npm или pnpm (npm идёт вместе с Node.js)

### Установка зависимостей

```bash
# Клонирование репозитория
git clone https://github.com/Jenison4ik/Custom_minecraft_launcher
cd ./launcher_app

# Установка зависимостей
npm install
# или
pnpm install
```

### Указываем параметры

В файле `./launcher_app/packages/main/src/launcherProperties.ts`

- `url` - адрес сервера где будет запущено приложение из `./server_app`
- `servers` - сервера которые будут отображаться в окне "Multiplayer" уже в самой игре

В файле `./launcher_app/package.json`

- `appId` - Уникальный идентификатор приложени (обычно это домен сайта задом наперёд)
- `productName` - Имя вашего приложения после сборки
- `publish -> url` - адрес для получения автообновлений лаунчера (указывайте тот же самый что и до этого)

## 🚀 Сборка

Из корневой директории

```bash
cd ./launcher_app
npm run pack
```

Собранный установщик лаунчера будет находится в `./launcher_app/out`.

## 📦 Установка и сборка серверного приложения



### Первый запуск (без SSL сертификатов):

```bash
# 1. Убедитесь, что в .env файле указана переменная DOMAIN
# Например: DOMAIN=jenison.ru

# 2. Запустите nginx и app (nginx автоматически запустится в режиме без HTTPS)
docker compose up -d nginx app

# 3. Получите SSL сертификаты
docker compose --profile init run --rm certbot-init

# 4. Перезагрузите nginx (он автоматически переключится на HTTPS)
docker exec nginx_proxy nginx -s reload

# 5. Поднимаем остальное приложение
docker compose up -d --build
```

После этого приложение полностью готово к работе

## API сервера

Полная документация: **[server_app/API.md](./server_app/API.md)** — как устроен API, что загружать, как обновлять сборку и лаунчер, примеры `curl`.

Кратко:

| Метод | Путь | Назначение |
|-------|------|------------|
| `POST` | `/minecraft/api/upload` | Загрузить ZIP сборки Minecraft (`x-secret-key` + поле `file`) → `manifest.json` + `minecraft_files.zip` |
| `GET` | `/minecraft/api/download` | Скачать архив сборки |
| `GET` | `/minecraft/api/manifest` | Манифест файлов (SHA-1 + size) |
| `GET` | `/minecraft/api/latest` | Версия лаунчера из `version.json` |
| `GET` | `/minecraft/api/latest.yml` | Метаданные для `electron-updater` |
| `GET` | `/minecraft/api/downloadGame.exe` | Скачать установщик лаунчера |
| `POST` | `/minecraft/api/uploadGame` | Загрузить обновление лаунчера (`x-secret-key`, `version`, `file`, `yml`) |

Загрузки защищены заголовком `x-secret-key` (= `SECRET_KEY` из `.env`).

### Обновить сборку Minecraft

1. Упакуйте содержимое `.minecraft` (mods, versions, libraries, assets, …) в `.zip`
2. Отправьте на `POST /minecraft/api/upload` с `x-secret-key`
3. Клиенты подтянут изменения при следующем запуске (сравнение манифеста)

### Обновить лаунчер

1. Соберите лаунчер (`npm run pack` в `launcher_app`)
2. Отправьте ZIP установщика + содержимое `latest.yml` на `POST /minecraft/api/uploadGame`

**Приятной игры! 🎮**

## 📄 Лицензия

MIT License

