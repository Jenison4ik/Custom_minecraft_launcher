# Jenison Launcher (`launcher_app`)

Electron-лаунчер Minecraft (Jenison). Работает в трёх процессах + shared-пакет для IPC.

## Быстрый старт

```bash
cd launcher_app
npm install
npm run dev          # tsc watch (shared/main/preload) + vite renderer
# в другом терминале:
npm start            # electron с VITE_DEV_SERVER_URL=http://localhost:5173

npm run build        # shared → main → preload → renderer → dist/
npm run pack         # build + electron-builder → out/
```

Entry packaged app: `dist/main/index.js` (`package.json` → `"main"`).

## Архитектура процессов

```
Renderer (React)  →  window.launcherAPI  →  Preload (contextBridge)
                                              ↓ ipcRenderer.invoke / .on
Main (Node)       ←  ipcMain.handle / webContents.send
```

- `contextIsolation: true`, `nodeIntegration: false` — не ослаблять.
- Renderer **не** импортирует `electron` и Node API.
- Любой новый IPC: канал в `packages/shared`, handler в main, метод в preload, тип в `LauncherAPI`.

## Пакеты

| Пакет | Роль | Сборка |
|-------|------|--------|
| `packages/shared` | `CHANNELS`, типы `LauncherAPI` (`@jenison/shared`) | `tsc` → `packages/shared/dist` |
| `packages/main` | Окно, IPC, Minecraft, файлы, updater | `tsc` → `dist/main` |
| `packages/preload` | `contextBridge.exposeInMainWorld("launcherAPI", …)` | **esbuild bundle** → `dist/preload` (инлайнит `@jenison/shared`; sandbox preload не умеет `require` из node_modules) |
| `packages/renderer` | React UI (Vite) | vite → `dist/renderer` |

Импорт shared: `import { CHANNELS, … } from "@jenison/shared"` (`file:packages/shared`).

## Карта `packages/main/src`

| Путь | Назначение |
|------|------------|
| `index.ts` | Только lifecycle `app` (whenReady / quit / activate) |
| `window/createWindow.ts` | `BrowserWindow`, preload path, loadURL/loadFile |
| `ipc/registerHandlers.ts` | Точка регистрации всех handlers |
| `ipc/handlers/*` | config, launch, download, filesystem |
| `services/configService.ts` | Единственный CRUD `userData/config.json` |
| `services/notifyService.ts` | Toast / download progress / launch status → renderer |
| `services/statusService.ts` | Флаг «операция/игра запущена» |
| `services/updaterService.ts` | `electron-updater` |
| `services/paths.ts` | `.minecraft` dir, `openLauncherDir`, `mcPath` |
| `minecraft/installer/` | Установка version/libs/assets + Fabric |
| `minecraft/launch/` | Запуск через `@xmcl/core` |
| `minecraft/java/` | `ensureJava` |
| `config/launcherProperties.ts` | URL API, **версия MC + загрузчик** (источник правды для игры) |
| `minecraft/resolveGameSpec.ts` | properties + nickname/ram/disableDownload → GameSpec |
| `utils/` | addServer, manifests, undiciAgent, legacy helpers |
| `types/LauncherConfig.ts` | Тип игрового конфига |

## Карта UI (`packages/renderer/src`)

- `pages/` — Home, Settings
- `components/` — Layout, кнопки, toasts, inputs
- `hooks/`, `providers/`, `styles/`
- `types/launcher-api.d.ts` — `Window.launcherAPI` из `@jenison/shared`

Стили рядом по смыслу: SCSS в `styles/`, импорт из компонента как `../styles/Foo.scss`.

## IPC-каналы

Источник истины: `packages/shared/src/ipc-channels.ts`.

**Invoke (renderer → main):** `get-configs`, `get-mem-size`, `run-minecraft`, `add-to-configs`, `open-launcher-dir`, `download-minecraft`, `is-launched`.

**Push (main → renderer):** `show-error-toast`, `show-download-status`, `launch-minecraft`.

Не добавляй строковые литералы каналов в main/preload/renderer — только `CHANNELS.*`.

## Куда класть новый код

| Задача | Куда |
|--------|------|
| Новый IPC-метод | `shared` → `ipc/handlers/*` → `preload` → UI |
| Логика Minecraft | `minecraft/installer` или `minecraft/launch` |
| Уведомления UI из main | `services/notifyService` |
| Настройки лаунчера | `services/configService` |
| Новый экран | `renderer/src/pages/` |
| Переиспользуемый виджет | `renderer/src/components/` |

`index.ts` main не раздувать: только bootstrap.

## Важные пути рантайма

- Конфиг пользователя: `app.getPath("userData")/config.json`
- Игра: `userData/.minecraft` (`mcPath`)
- Java: `userData/java/java{N}`
- Дефолтный `config.json` в корне `launcher_app` копируется в `dist/main/` при build
- Preload в окне: `dist/preload/index.js` (относительно `dist/main/window` → `../../preload`)

## Стек

Electron 31, React 18, Vite 5, TypeScript, Sass, `@xmcl/core` / `@xmcl/installer`, `electron-updater`, undici.

Сборка **не** на electron-vite (пакет в deps есть, но не используется): `tsc` + Vite + `electron-builder`.

## Установка / запуск Minecraft

Источник правды: `packages/main/src/config/launcherProperties.ts` (`mcVersion`, `mcCore`, опционально `loaderVersion`).

- `mcCore`: `vanilla` | `fabric` | `forge` | `quilt` | `neoforge`
- Pipeline: `resolveGameSpec` → vanilla base → loader installer → `installDependencies` → `launch(versionId)`
- User `config.json` хранит только nickname / ram / `disableDownload`

## Правила для агента

1. Сохраняй разделение main / preload / renderer / shared.
2. Не включай `nodeIntegration`; не expose сырой `ipcRenderer` в renderer.
3. Не дублируй типы API в `App.tsx` — только `@jenison/shared`.
4. После изменений shared/main/preload проверяй `npm run build` из `launcher_app`.
5. Бизнес-логику Minecraft не смешивай с UI; UI ходит только через `window.launcherAPI`.
6. Этот `AGENTS.md` описывает только `launcher_app` (не `server_app`).
