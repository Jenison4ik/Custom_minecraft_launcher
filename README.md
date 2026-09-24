![cml-banner](https://github.com/user-attachments/assets/60ec944f-343e-4062-809a-182fc53886ff)

# Custom MC Launcher

![Stars](https://img.shields.io/github/stars/Jenison4ik/Custom_minecraft_launcher?style=for-the-badge&logo=github)
![Forks](https://img.shields.io/github/forks/Jenison4ik/Custom_minecraft_launcher?style=for-the-badge&logo=github)
![License](https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.7.0-111827?style=for-the-badge)
![Node](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-31-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=FFD62E)
![Windows](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white)
![Minecraft](https://img.shields.io/badge/Minecraft-Java-3D7A2A?style=for-the-badge)
![Fabric](https://img.shields.io/badge/Fabric-DBD0B4?style=for-the-badge&logoColor=black)
![Forge](https://img.shields.io/badge/Forge-DEA42A?style=for-the-badge)
![Quilt](https://img.shields.io/badge/Quilt-6B4BA1?style=for-the-badge)
![NeoForge](https://img.shields.io/badge/NeoForge-E67E22?style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

Свой лаунчер для Minecraft проектов и серверов с модами. Игрок вводит ник и нажимает «Запустить» лаунчер полностью берёт управление на себя: ставит игру, нужную Java, модлоадер и всю сборку. Игрокам теперь больше не надо ничего устанавливать руками

Это клиент под один модпак, а не общий магазин сборок. Версия Minecraft, загрузчик (Fabric, Forge, Quilt, NeoForge или ваниль), список модов и адреса серверов задаются в админке и приходят всем одинаковыми. Новые моды и правки сборки доезжают сами, поэтому на сервер заходят с тем набором, который собрали вы. Свой установщик, своё окно и автообновление лаунчера игроки скачивают один файл и сразу играют на вашем сервере.

## Для игрока

На главном экране видны название сборки, адрес сервера, версия Minecraft и модлоадер. Ник вводится прямо в окне лаунчера ToDo (Планируется сделать список новостей и возможность создания кастомных экранов)

Перед запуском лаунчер сам:

- ставит нужную версию Minecraft и модлоадер;
- скачивает Java, если своей нет;
- подтягивает файлы сборки и приводит папку `mods` к тому, что лежит на сервере — лишние моды убираются.

Если сервер недоступен, запускается последняя сохранённая сборка. Пока сборка ни разу не была получена, игра не стартует.

В настройках можно:

- выделить оперативную память с учётом памяти компьютера;
- выбрать разрешение окна, своё разрешение или полный экран;
- спрятать лаунчер на время игры — окно вернётся, когда игра закроется;
- указать свою Java и дополнительные аргументы JVM;
- отключить проверку файлов, заново скачать игру, открыть папку игры и логи;
- проверить обновление самого лаунчера.

## Для владельца сборки

Админка на `/admin`. Через неё собирается то, что получат все лаунчеры.

**Сборка.** Версия Minecraft, загрузчик (Vanilla, Fabric, Forge, Quilt или NeoForge) и его версия. Пункт «Рекомендуемая» при сохранении фиксируется конкретным номером. Здесь же список серверов: название и адрес, которые видит игрок.

**Моды.** Загрузка `.jar`, поиск и удаление. Каталог Modrinth и CurseForge подставляет моды под текущую версию и загрузчик. Если мод не подходит к сборке, админка показывает проблему.

**Лаунчер.** Публикация новой версии установщика: игроки получают её через проверку обновлений.

Внешний вид окна задаётся до сборки установщика: цвета, шрифты, скругления и расположение блоков. Сервер тему на лету не меняет.

## Сборка и запуск

Нужен [Node.js](https://nodejs.org/) 20+.

```bash
git clone https://github.com/Jenison4ik/Custom_minecraft_launcher
cd launcher_app
npm install
npm run dev    # окно лаунчера
npm run pack   # установщик в launcher_app/out
```

Сервер раздачи — каталог `server_app`. В `.env` задайте `DOMAIN`. Первый запуск и сертификат описаны в [server_app/nginx/SSL_SETUP.md](./server_app/nginx/SSL_SETUP.md). API — в [server_app/API.md](./server_app/API.md).

| Что менять                | Где                                                           |
| ------------------------- | ------------------------------------------------------------- |
| Адрес API                 | `launcher_app/packages/main/src/config/launcherProperties.ts` |
| Имя и обновления лаунчера | `launcher_app/package.json`, секция `build`                   |
| Тема окна                 | `launcher_app/packages/renderer/src/styles/theme.css`         |

Стек: Electron, React, Vite, TypeScript. Установка Minecraft — `@xmcl`. Обновления лаунчера — `electron-updater`.

## Лицензия

MIT
