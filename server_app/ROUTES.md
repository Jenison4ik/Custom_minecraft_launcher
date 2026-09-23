# Маршруты

Базовый URL API: `https://<домен>/minecraft/api`. Локально: `http://localhost:8080`.

Панель в проде открывается по `/admin`. В dev Vite слушает `http://localhost:5173/admin` и проксирует `/minecraft/api` на API.

Админские маршруты `v1` требуют заголовок `Authorization: Bearer <token>`. Токен выдаёт `POST /minecraft/api/v1/auth/login`. Без токена или с неверным JWT ответ `401 { "error": "Unauthorized" }`.

Если задан `CORS_ORIGIN`, сервер отвечает на preflight `OPTIONS` статусом `204` и разрешает заголовки `Authorization`, `Content-Type`, `version` и методы `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`.

JSON-тело запросов ограничено `2mb`. Загрузки идут через `multipart/form-data`.

## Корень приложения

### `GET /`

Текст: `Hello, from Jenison`s MC Launcher!`

## Авторизация

Префикс: `/minecraft/api/v1/auth`

### `POST /minecraft/api/v1/auth/login`

Тело JSON:

```json
{ "username": "admin", "password": "change-me" }
```

Логин и пароль сравниваются с `ADMIN_USERNAME` и `ADMIN_PASSWORD`. Токен подписывается `JWT_SECRET`, срок — `JWT_EXPIRES` (по умолчанию `12h`).

Ответ `200`:

```json
{ "token": "<jwt>", "expiresIn": "12h" }
```

| Статус | Когда |
|--------|--------|
| `401` | Неверный логин или пароль. `{ "error": "Unauthorized" }` |
| `503` | Не заданы `JWT_SECRET`, `ADMIN_USERNAME` или `ADMIN_PASSWORD`. `{ "error": "Auth is not configured" }` |

## Публичное API v1

Префикс: `/minecraft/api/v1`. Токен не нужен.

### `GET /minecraft/api/v1/manifest`

Манифест сборки из `data/manifest.json`. Если файла нет, он собирается по каталогу `game/`.

Ответ `200`:

```json
{
  "files": {
    "mods/example.jar": { "sha1": "<hex>", "size": 123 }
  }
}
```

`500` — `{ "error": "Manifest is not generated" }`.

### `GET /minecraft/api/v1/files/<путь>`

Один файл из `game/`. Путь совпадает с ключом в манифесте, например `mods/example.jar`.

| Статус | Когда |
|--------|--------|
| `200` | Содержимое файла |
| `400` | Путь выходит из `game/` (`..` и аналоги). `{ "error": "Invalid path" }` |
| `404` | Файла нет. `{ "error": "File not found" }` |
| `500` | `{ "error": "Error sending file" }` |

## Админское API v1

Префикс: `/minecraft/api/v1/admin`. На все маршруты ниже нужен Bearer-токен.

### `GET /minecraft/api/v1/admin/files`

Список файлов манифеста, постранично.

| Query | По умолчанию | Ограничение |
|-------|----------------|-------------|
| `q` | пусто | Подстрока пути, без учёта регистра |
| `limit` | `50` | от `1` до `200` |
| `offset` | `0` | от `0` |

Ответ `200`:

```json
{
  "total": 1,
  "limit": 50,
  "offset": 0,
  "files": [{ "path": "mods/example.jar", "sha1": "<hex>", "size": 123 }]
}
```

### `PUT /minecraft/api/v1/admin/files`

Загрузка одного `.jar` в `game/`. Несколько модов — отдельные запросы.

`multipart/form-data`:

| Поле | Тип | Смысл |
|------|-----|--------|
| `file` | файл | Содержимое |
| `path` | текст | Относительный путь, обязан заканчиваться на `.jar`, например `mods/example.jar` |

Файл пишется в `game/<path>`, в манифесте обновляется одна запись. Legacy-ZIP пересобирается при следующем `GET /minecraft/api/download`, если архив старше манифеста.

Ответ `200`:

```json
{ "path": "mods/example.jar", "sha1": "<hex>", "size": 123 }
```

| Статус | Когда |
|--------|--------|
| `400` | Нет файла (`No file uploaded`), нет `path` (`Path is required`), не `.jar` (`Only .jar files are allowed`), путь вне `game/` (`Invalid path`) |
| `500` | `{ "error": "Error uploading file" }` |

### `DELETE /minecraft/api/v1/admin/files`

Тело JSON:

```json
{ "path": "mods/example.jar" }
```

Удаляет файл из `game/` и запись из манифеста.

Ответ `200`: `{ "ok": true }`.

| Статус | Когда |
|--------|--------|
| `400` | Нет `path` (`Path is required`), путь — каталог или выходит из `game/` (`Invalid path` / `Error deleting file`) |
| `404` | Файла нет ни на диске, ни в манифесте. `{ "error": "File not found" }` |
| `500` | `{ "error": "Error deleting file" }` |

### `GET /minecraft/api/v1/admin/mods/search`

Поиск модов. Страница фиксирована: 20 результатов.

| Query | Обязательно | Значения |
|-------|-------------|----------|
| `source` | да | `modrinth` или `curseforge` |
| `q` | нет | Строка поиска |
| `gameVersion` | да | Например `1.20.1`. Шаблон: цифра, затем до 31 символа из `0-9A-Za-z._-` |
| `loader` | да | `fabric`, `forge`, `neoforge`, `quilt` |
| `offset` | нет | Смещение, по умолчанию `0` |

Modrinth вызывается без ключа. CurseForge использует `CURSEFORGE_API_KEY` на сервере.

Ответ `200`:

```json
{
  "total": 1,
  "hits": [
    {
      "id": "AA123",
      "title": "Sodium",
      "description": "Rendering",
      "iconUrl": "https://cdn.modrinth.com/icon.png"
    }
  ]
}
```

`iconUrl` может быть `null`.

| Статус | Сообщение |
|--------|-----------|
| `400` | `Неизвестный каталог` или `Укажите версию и загрузчик` |
| `502` | `Каталог временно недоступен` |
| `503` | `Ключ CurseForge не задан` |

### `POST /minecraft/api/v1/admin/mods/install`

Сервер скачивает последний релизный `.jar` под фильтры и сохраняет его как `mods/<имя файла>.jar`. Манифест обновляется сразу. Зависимости мода не ставятся.

Тело JSON:

```json
{
  "source": "modrinth",
  "projectId": "AA123",
  "gameVersion": "1.20.1",
  "loader": "fabric"
}
```

`projectId` — только латинские буквы и цифры.

Ответ `200`:

```json
{ "path": "mods/sodium.jar", "sha1": "<hex>", "size": 123 }
```

| Статус | Сообщение |
|--------|-----------|
| `400` | `Неизвестный каталог`, `Укажите версию и загрузчик`, `Неизвестный мод`, `Можно скачивать только .jar`, `Ссылка на файл отклонена` |
| `404` | `Релиз для этой версии не найден` или `У релиза нет .jar` |
| `502` | `Каталог временно недоступен` |
| `503` | `Ключ CurseForge не задан` |

### `GET /minecraft/api/v1/admin/launcher`

Текущие метаданные установщика. Если файлов нет, поля равны `null`.

Ответ `200`:

```json
{ "version": "1.6.5", "yml": "<содержимое latest.yml>" }
```

### `POST /minecraft/api/v1/admin/launcher`

Замена установщика. Каталог `launcher/` очищается, ZIP распаковывается в него. `data/latest.yml` и `data/version.json` перезаписываются.

| Часть запроса | Где | Смысл |
|---------------|-----|--------|
| `version` | заголовок | Версия, пишется в `version.json` |
| `file` | multipart-поле | ZIP установщика, расширение `.zip` |
| `yml` | текстовое поле формы | Содержимое `latest.yml` |

Ответ `200`:

```json
{ "message": "Launcher uploaded", "version": "1.6.5" }
```

| Статус | Когда |
|--------|--------|
| `400` | Нет файла (`No file uploaded`), нет заголовка `version` (`Version is required`), нет `yml` (`No YML content provided`), не `.zip` (`Only .zip files are allowed`) |
| `500` | `{ "error": "Error uploading launcher" }` |

## Legacy API

Префикс: `/minecraft/api`. Токен не нужен. Контракт старых клиентов.

`x-secret-key` больше не используется. `POST /upload` и `POST /uploadGame` сняты.

### `GET /minecraft/api/manifest`

Тот же JSON, что и `GET /minecraft/api/v1/manifest`.

`500` — `{ "error": "Manifest is not generated" }`.

### `GET /minecraft/api/download`

Архив `data/minecraft_files.zip`, имя отдачи `minecraft_files.zip`. Если архив старше манифеста, он пересобирается перед отдачей.

`500` — `{ "error": "Error generating archive" }`.

### `GET /minecraft/api/latest`

Читает `data/version.json`.

Ответ `200`:

```json
{ "version": "1.6.5", "url": "https://jenison.ru/download" }
```

`500` — `{ "error": "No version data" }`.

### `GET /minecraft/api/latest.yml`

Файл `data/latest.yml` для electron-updater.

`500` — текст `Error reading latest.yml`.

### `GET /minecraft/api/downloadGame.exe`

Первый файл из каталога `launcher/`. `Content-Type: application/x-msdownload`, имя берётся из файла на диске.

| Статус | Когда |
|--------|--------|
| `404` | В `launcher/` нет файлов. Текст `No file found in launcher directory` |
| `500` | Текст `Error downloading file` или `{ "error": "Error downloading file" }` |

## Панель `/admin`

Статика из собранного `admin/dist`, если каталог есть на диске. Любой путь под `/admin` без файла отдаёт `index.html`.

Vite `base` — `/admin/`, поэтому клиентские пути такие:

| Путь | Страница |
|------|----------|
| `/admin/login` | Вход |
| `/admin/files` | Файлы сборки и каталог модов |
| `/admin/launcher` | Загрузка установщика |
| `/admin/pack` | Редирект на `/admin/files` |
| любой другой | Редирект на `/admin/files` |

`/admin/files` и `/admin/launcher` без токена в браузере уводят на `/admin/login`.

## Nginx

В проде (`nginx/nginx.conf`) HTTP на порту 80 отдаёт `/.well-known/acme-challenge/` и редиректит остальное на HTTPS. `www` редиректит на основной домен.

| Location | Куда |
|----------|------|
| `/admin/` | `http://app:8080/admin/` |
| `/minecraft/api/` | `http://app:8080/minecraft/api/` |
| `/minecraft/map/` | `http://172.17.0.1:8100/` |
| `/robots.txt` | `static/robots.txt` |
| `/` | Статика `static/`, `try_files` до `404.html` |
