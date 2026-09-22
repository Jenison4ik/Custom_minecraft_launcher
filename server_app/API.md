# Server API — документация

Серверное приложение (`server_app`) раздаёт сборку Minecraft и обновления лаунчера клиентам. Лаунчер обращается к базовому URL вида:

```text
https://<ваш-домен>/minecraft/api
```

Этот URL задаётся в `launcher_app/packages/main/src/launcherProperties.ts` (поле `url`).

---

## Как это работает

```text
┌─────────────────┐         GET /manifest          ┌──────────────────┐
│  Лаунчер (ПК)   │ ──────────────────────────────►│   server_app     │
│                 │ ◄──────────────────────────────│                  │
│  1. Сравнивает  │         JSON манифест          │  data/           │
│     локальные   │                                │   manifest.json  │
│     файлы с     │         GET /download          │   minecraft_     │
│     сервером    │ ──────────────────────────────►│   files.zip      │
│                 │ ◄──────────────────────────────│   version.json   │
│  2. При         │         ZIP сборки             │   latest.yml     │
│     расхождении │                                │                  │
│     качает ZIP  │         GET /latest.yml        │  game/  (распак. │
│                 │ ──────────────────────────────►│         сборка)  │
│  3. electron-   │ ◄──────────────────────────────│  launcher/       │
│     updater     │         метаданные обновления  │   (установщик)   │
└─────────────────┘                                └──────────────────┘
```

1. При запуске игры лаунчер строит локальный манифест `.minecraft` и сравнивает его с `GET /manifest`.
2. Если SHA-1 или размер файлов не совпадают (или файлов нет) — скачивается `GET /download`, архив распаковывается поверх локальной сборки.
3. Обновления самого лаунчера идут через `electron-updater`: читается `latest.yml`, затем скачивается установщик.

Загрузка новых файлов на сервер (админские операции) защищена заголовком `x-secret-key`.

---

## Директории на сервере

| Путь | Назначение |
|------|------------|
| `game/` | Распакованная актуальная сборка Minecraft (моды, versions, libraries, assets и т.д.) |
| `data/` | Служебные файлы API: `manifest.json`, `minecraft_files.zip`, `version.json`, `latest.yml` |
| `launcher/` | Распакованный установщик лаунчера (то, что отдаёт `downloadGame.exe`) |
| `uploads/` | Временные файлы multer (удаляются после обработки) |

В Docker эти каталоги монтируются как volumes (`docker-compose.yml`):

```yaml
volumes:
  - ./data:/app/data
  - ./game:/app/game
  - ./launcher:/app/launcher
```

---

## Переменные окружения

Скопируйте `.env.template` → `server_app/.env` (или корневой `.env`, если так настроен compose):

| Переменная | Описание |
|------------|----------|
| `PORT` | Порт Node.js (по умолчанию `8080`) |
| `SECRET_KEY` | Секрет для загрузки файлов (заголовок `x-secret-key`) |
| `DOMAIN` | Домен для nginx / SSL |
| `LETSENCRYPT_EMAIL` | Email для Let's Encrypt |

---

## Авторизация

Эндпоинты **загрузки** требуют заголовок:

```http
x-secret-key: <значение SECRET_KEY из .env>
```

Сравнение ключа выполняется через `crypto.timingSafeEqual`. При неверном ключе:

```json
{ "error": "Unauthorized" }
```

Статус: `401`.

Публичные (клиентские) эндпоинты ключ **не** требуют: `download`, `manifest`, `latest`, `latest.yml`, `downloadGame.exe`.

---

## Что загружать: сборка Minecraft

### Формат архива

- Только **`.zip`**
- Внутри — содержимое папки `.minecraft` (корневые папки/файлы сборки, **без** лишней обёртки вида `minecraft/...`, если только вы сами так не организуете клиент)

Типичная структура внутри ZIP:

```text
mods/
versions/
libraries/
assets/
config/          # опционально
options.txt      # опционально
...
```

После `POST /upload` сервер:

1. Проверяет `x-secret-key`
2. Очищает `game/`
3. Распаковывает ZIP в `game/`
4. Строит `data/manifest.json` (SHA-1 + size каждого файла)
5. Собирает `data/minecraft_files.zip` из всего содержимого `game/` (включая скрытые файлы)

### Пример загрузки сборки

```bash
curl -X POST "https://example.com/minecraft/api/upload" \
  -H "x-secret-key: YOUR_SECRET_KEY" \
  -F "file=@./my_modpack.zip"
```

Успешный ответ (`200`):

```json
{
  "message": "File uploaded and archive prepared successfully",
  "archive": ".../data/minecraft_files.zip"
}
```

Ошибки:

| Код | Причина |
|-----|---------|
| `401` | Неверный или отсутствующий `x-secret-key` |
| `400` | Нет файла или расширение не `.zip` |
| `500` | Ошибка распаковки / манифеста / архивации |

Поле формы обязательно называется **`file`**.

---

## Что загружать: обновление лаунчера

Нужны два артефакта после `npm run pack` в `launcher_app`:

1. **ZIP с установщиком** — внутри должен лежать готовый `.exe` / установщик (сервер кладёт содержимое в `launcher/` и при скачивании отдаёт **первый файл** из этой папки).
2. **`latest.yml`** — метаданные для `electron-updater` (генерируется electron-builder).

### `POST /minecraft/api/uploadGame`

| Параметр | Где | Описание |
|----------|-----|----------|
| `x-secret-key` | header | Секрет |
| `version` | header | Версия лаунчера, например `1.6.5` (пишется в `data/version.json`) |
| `file` | multipart | ZIP с установщиком |
| `yml` | multipart (текстовое поле) | Содержимое `latest.yml` |

Пример:

```bash
curl -X POST "https://example.com/minecraft/api/uploadGame" \
  -H "x-secret-key: YOUR_SECRET_KEY" \
  -H "version: 1.6.5" \
  -F "file=@./launcher_release.zip" \
  -F "yml=$(cat ./out/latest.yml)"
```

После успешной загрузки:

- `launcher/` содержит распакованный установщик
- `data/latest.yml` обновлён
- `data/version.json` содержит `{ "version": "1.6.5" }`

Пример `latest.yml` (electron-builder):

```yaml
version: 1.6.5
files:
  - url: Jenison-Launcher-Setup-1.6.5.exe
    sha512: ...
    size: 12345678
path: Jenison-Launcher-Setup-1.6.5.exe
sha512: ...
releaseDate: '2026-08-09T12:00:00.000Z'
```

Имя файла в `url` / `path` должно соответствовать тому, что реально лежит в `launcher/` после распаковки ZIP.

---

## Эндпоинты

Базовый префикс: `/minecraft/api`

### `GET /`

Корневой ping приложения (без префикса API):

```text
Hello, from Jenison`s MC Launcher!
```

---

### Сборка Minecraft

#### `POST /minecraft/api/upload`

Загрузить новую сборку (см. выше). Требует `x-secret-key`.

#### `GET /minecraft/api/download`

Скачать подготовленный архив `data/minecraft_files.zip`.

- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="minecraft_files.zip"`

Если архива ещё нет:

```json
{ "error": "Archive not found. Upload game first." }
```

Статус: `404`.

Используется лаунчером при рассинхроне файлов.

#### `GET /minecraft/api/manifest`

Вернуть манифест сборки.

Формат:

```json
{
  "files": {
    "mods/example.jar": {
      "sha1": "a1b2c3...",
      "size": 12345
    },
    "versions/1.20.1/1.20.1.jar": {
      "sha1": "d4e5f6...",
      "size": 67890
    }
  }
}
```

- Если есть `data/manifest.json` — отдаётся он.
- Если файла нет — манифест генерируется на лету из `game/`.

Лаунчер сравнивает локальный манифест с серверным: для каждого файла с сервера должны совпасть `sha1` и `size`.

---

### Версии и обновления лаунчера

#### `GET /minecraft/api/latest`

Текущая версия клиента из `data/version.json`:

```json
{
  "version": "1.6.5",
  "url": "https://jenison.ru/download"
}
```

Если `version.json` отсутствует — `500` с `{ "error": "No version data" }`.

#### `GET /minecraft/api/latest.yml`

Отдаёт файл `data/latest.yml` для `electron-updater`.

#### `GET /minecraft/api/downloadGame.exe`

Отдаёт **первый файл** из каталога `launcher/` как вложение (`application/x-msdownload`).

Если каталог пуст — `404`.

#### `POST /minecraft/api/uploadGame`

Загрузить установщик + YML + версию (см. раздел выше). Требует `x-secret-key`.

---

## Типовые сценарии

### Обновить модпак на сервере

1. Соберите рабочую папку `.minecraft` (моды, версии Fabric/Forge и т.д.).
2. Упакуйте её в ZIP.
3. Выполните `POST /upload` с `x-secret-key`.
4. Убедитесь, что `GET /manifest` и `GET /download` отвечают успешно.
5. У клиентов при следующем запуске игры файлы сами подтянутся при расхождении манифеста.

### Выкатить новый лаунчер

1. В `launcher_app` поднимите `version` в `package.json`.
2. Соберите: `npm run pack` → артефакты в `launcher_app/out`.
3. Упакуйте установщик в ZIP.
4. Выполните `POST /uploadGame` с заголовком `version`, полем `file` и содержимым `latest.yml` в поле `yml`.
5. Клиенты получат обновление через `electron-updater` (`latest.yml` + скачивание бинарника).

### Первичная настройка сервера

1. Заполните `.env` (`PORT`, `SECRET_KEY`, `DOMAIN`, …).
2. Поднимите Docker (см. корневой `README.md` и `nginx/README.md`).
3. Загрузите первую сборку Minecraft (`POST /upload`).
4. Загрузите первую сборку лаунчера (`POST /uploadGame`).
5. В лаунчере укажите `url` на ваш `/minecraft/api`.

---

## Ограничения nginx

В `nginx.conf` задано:

```nginx
client_max_body_size 5G;
```

Таймауты прокси для API увеличены (до ~1000s), чтобы большие ZIP успевали загрузиться и скачаться.

---

## Краткая шпаргалка curl

```bash
# Загрузка сборки Minecraft
curl -X POST "$API/upload" \
  -H "x-secret-key: $SECRET_KEY" \
  -F "file=@modpack.zip"

# Манифест
curl "$API/manifest"

# Скачать сборку
curl -OJ "$API/download"

# Версия лаунчера
curl "$API/latest"

# latest.yml
curl "$API/latest.yml"

# Загрузка обновления лаунчера
curl -X POST "$API/uploadGame" \
  -H "x-secret-key: $SECRET_KEY" \
  -H "version: 1.6.5" \
  -F "file=@launcher.zip" \
  -F "yml=<latest.yml"
```

где `API=https://example.com/minecraft/api`.
