# Custom Minecraft Launcher

![Stars](https://img.shields.io/github/stars/Jenison4ik/Custom_minecraft_launcher)
![License](https://img.shields.io/badge/license-MIT-green)

Свой лаунчер Minecraft под одну сборку: версия игры, модлоадер и внешний вид задаются до сборки установщика. Клиент сам ставит игру и Java, сверяет файлы сборки с сервером и обновляет лаунчер.

## Возможности

| | |
| --- | --- |
| **Модлоадеры** | Vanilla, Fabric, Forge, Quilt и NeoForge — один и тот же пайплайн установки |
| **Тема** | Цвета, шрифты и раскладка окна правятся в одном CSS-файле, без правок компонентов |
| **Сборка клиента** | Манифест на сервере: у игрока остаётся актуальная версия ваших файлов |
| **Java** | Нужная мажорная версия скачивается сама, по требованиям выбранного Minecraft |
| **Память** | Лимит RAM в настройках, с учётом памяти компьютера |
| **Обновления** | Установщик лаунчера раздаётся через `electron-updater` |

## Модлоадеры

Источник правды для версии игры — профиль на сервере, файл `server_app/data/profile.json`. Его задаёт админка: версия Minecraft, загрузчик и конкретная версия загрузчика. Пункт «Рекомендуемая» при сохранении превращается в номер, который получат все лаунчеры. Пока файл не сохранён, `GET /minecraft/api/v1/profile` отвечает `404`, запасной версии нет.

В `launcherProperties.ts` остаётся только URL API. При старте лаунчер забирает профиль и кэширует его. Если сервер недоступен, запускается последняя сохранённая сборка. Если кэша ещё не было или сервер ответил `404`, игра не стартует. При связи с сервером папка `mods` приводится к манифесту: лишние файлы удаляются.

Установка идёт так: ванильная база → загрузчик модов → библиотеки и ассеты → сверка `mods` → запуск итоговой версии. Ник, RAM и отключение проверки файлов игрок хранит у себя в `config.json`; версию и модлоадер он не выбирает.

## Своя тема

Интерфейс разделён на два файла в `launcher_app/packages/renderer/src/styles/`:

| Файл | Что в нём |
| --- | --- |
| `base.css` | Разметка компонентов: кнопки, поля, тосты, полоса загрузки |
| `theme.css` | То, что меняется от проекта к проекту |

`theme.css` подключается после `base.css`. В нём CSS-переменные на `:root` и правила положения.

Что можно задать токенами:

- цвета фона, текста, акцента, полей, тостов и полосы загрузки;
- шрифты и размеры;
- скругления и тени;
- отступы и колонки нижней панели.

Положение блоков — отдельные правила в том же файле: колонка кнопки «Запустить», ника и панели инструментов, порядок секций на экране настроек, угол тостов, место полосы загрузки. Достаточно поменять `grid-column`, `order`, `justify-content`, `margin` или `inset`.

Ограничение темы: не скрывайте блоки через `display: none` и не добавляйте селекторы для элементов, которых нет в разметке. Внешний вид сборки собирается вместе с лаунчером — сервер тему на лету не подменяет.

## Как собрать лаунчер

Нужен [Node.js](https://nodejs.org/) 20+.

```bash
git clone https://github.com/Jenison4ik/Custom_minecraft_launcher
cd launcher_app
npm install
```

Разработка (TypeScript, Vite и окно Electron):

```bash
npm run dev
```

Установщик (`launcher_app/out`):

```bash
npm run pack
```

### Параметры проекта

`launcher_app/packages/main/src/config/launcherProperties.ts`

- `url` — API из `server_app`, откуда клиент берёт профиль сборки и файлы
- версия Minecraft, загрузчик и список серверов задаются в админке и лежат в `data/profile.json`

`launcher_app/package.json`, секция `build`

- `appId` — идентификатор приложения (домен задом наперёд, например `ru.jenison`)
- `productName` — имя установщика и окна
- `publish.url` — адрес раздачи автообновлений лаунчера

Оформление — `launcher_app/packages/renderer/src/styles/theme.css`.

## Сервер раздачи

Каталог `server_app`. В `.env` задайте домен:

```env
DOMAIN=jenison.ru
```

Первый запуск, пока нет сертификата:

```bash
docker compose up -d nginx app
docker compose --profile init run --rm certbot-init
docker exec nginx_proxy nginx -s reload
docker compose up -d --build
```

Nginx поднимается по HTTP, после сертификата переключается на HTTPS.

## API

Подробности, формат архива и примеры `curl`: [server_app/API.md](./server_app/API.md).

| Метод | Путь | Назначение |
| --- | --- | --- |
| `GET` | `/minecraft/api/manifest` | Манифест файлов (SHA-1 и размер) |
| `GET` | `/minecraft/api/download` | ZIP сборки для старых клиентов |
| `GET` | `/minecraft/api/v1/manifest` | Тот же манифест |
| `GET` | `/minecraft/api/v1/files/<путь>` | Один файл сборки |
| `POST` | `/minecraft/api/v1/auth/login` | JWT для админки |
| `GET` | `/admin` | Админ-панель |

Загрузка сборки и лаунчера идёт через панель и JWT (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`). Старые `GET /manifest` и `GET /download` остаются.

## Стек

Electron 31, React 18, Vite 5, TypeScript. Установка и запуск Minecraft — `@xmcl/core` и `@xmcl/installer`. Обновления лаунчера — `electron-updater`.

## Лицензия

MIT
