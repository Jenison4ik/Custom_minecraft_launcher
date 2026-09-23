# Server API

Базовый URL лаунчера: `https://<домен>/minecraft/api`.

Старые клиенты читают манифест и скачивают сборку одним ZIP. Новая пофайловая отдача и админка живут на `/minecraft/api/v1`. Панель открывается по `/admin`.

## Локально без SSL

Скопируйте `.env.example` в `.env`. `DOMAIN` и сертификаты не нужны.

```bash
npm install
npm run dev
```

В другом терминале:

```bash
cd admin
npm install
npm run dev
```

API: `http://localhost:8080`. Панель: `http://localhost:5173/admin`. Vite проксирует `/minecraft/api` на API.

Docker без nginx:

```bash
docker compose -f docker-compose.local.yml up --build
```

Продакшен с HTTPS по-прежнему поднимается через `docker-compose.yml` и nginx.

## Каталоги

| Путь | Назначение |
|------|------------|
| `game/` | Распакованная сборка |
| `data/` | `manifest.json`, `minecraft_files.zip`, `version.json`, `latest.yml` |
| `launcher/` | Файлы установщика лаунчера |
| `uploads/` | Временные загрузки |

## Авторизация

Админские маршруты `v1` требуют `Authorization: Bearer <token>`.

```bash
curl -X POST http://localhost:8080/minecraft/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"change-me\"}"
```

Ответ: `{ "token": "...", "expiresIn": "12h" }`. Логин и пароль берутся из `ADMIN_USERNAME` и `ADMIN_PASSWORD`, подпись — `JWT_SECRET`.

`x-secret-key` больше не используется. Старые `POST /upload` и `POST /uploadGame` сняты.

## Legacy

Без токена, контракт прежний.

### `GET /minecraft/api/manifest`

```json
{ "files": { "mods/example.jar": { "sha1": "...", "size": 123 } } }
```

### `GET /minecraft/api/download`

`data/minecraft_files.zip`. Если архив старше манифеста, он пересобирается перед отдачей.

### `GET /minecraft/api/latest`

`{ "version": "1.6.5", "url": "https://jenison.ru/download" }`

### `GET /minecraft/api/latest.yml`

Файл для electron-updater.

### `GET /minecraft/api/downloadGame.exe`

Первый файл из `launcher/`.

## v1, публично

### `GET /minecraft/api/v1/manifest`

Тот же JSON, что и legacy-манифест.

### `GET /minecraft/api/v1/files/<путь>`

Один файл из `game/`. Путь как в манифесте, например `mods/example.jar`. Выход из каталога (`..`) отвечает `400`.

## v1, админ

### `GET /minecraft/api/v1/admin/files?q=&limit=&offset=`

Страница списка: `{ total, limit, offset, files: [{ path, sha1, size }] }`.

### `PUT /minecraft/api/v1/admin/files`

Multipart: поле `file` и текстовое поле `path`. Путь должен заканчиваться на `.jar`. Файл пишется в `game/` рядом с остальными, в манифесте обновляется одна запись. Несколько модов отправляются отдельными запросами. Legacy-ZIP пересобирается при следующем `GET /download`, если он старше манифеста.

### `DELETE /minecraft/api/v1/admin/files`

JSON `{ "path": "mods/example.jar" }`.

### `GET /minecraft/api/v1/admin/mods/search?source=&q=&gameVersion=&loader=&offset=`

`source`: `modrinth` или `curseforge`. `loader`: `fabric`, `forge`, `neoforge`, `quilt`. Версия и загрузчик обязательны.

Ответ: `{ total, hits: [{ id, title, description, iconUrl }] }`.

Modrinth вызывается без ключа. CurseForge использует `CURSEFORGE_API_KEY` на сервере. Если ключ пустой, маршрут отвечает `503`.

### `POST /minecraft/api/v1/admin/mods/install`

JSON `{ "source", "projectId", "gameVersion", "loader" }`. Сервер скачивает последний релизный `.jar` под эти фильтры и сохраняет его как `mods/<имя файла>.jar`. Манифест обновляется сразу. Legacy-ZIP пересобирается при следующем `GET /download`. Зависимости мода не ставятся.

### `GET /minecraft/api/v1/admin/launcher`

`{ "version": "1.6.5", "yml": "..." }`

### `POST /minecraft/api/v1/admin/launcher`

Заголовок `version`, multipart-поле `file` (ZIP установщика) и текстовое поле `yml` (содержимое `latest.yml`).
