# Custom Minecraft Launcher

Кастомный лаунчер для Minecraft, построенный на Electron и React с TypeScript.

## 🎮 Функциональность

- **Запуск Minecraft** с настраиваемыми параметрами
- **Управление никнеймом** игрока
- **Настройка RAM** для игры с учетом доступной памяти системы
- **Автоматическая установка Java 17** при необходимости
- **Сохранение настроек** в config.json
- **Современный UI** на React с TypeScript

## 🛠 Технологии

- **Electron** - для создания десктопного приложения
- **React** - для пользовательского интерфейса
- **TypeScript** - для типизации кода
- **Vite** - для сборки и разработки
- **Node.js** - для backend логики

## 📦 Установка

### Предварительные требования

- Node.js (версия 16 или выше)
- npm или pnpm

### Установка зависимостей

```bash
# Клонирование репозитория
git clone <repository-url>
cd Custom_minecraft_launcher

# Установка зависимостей
npm install
# или
pnpm install
```

## 🚀 Запуск

### Режим разработки

```bash
# Запуск всех процессов разработки одновременно
npm run dev

# Или запуск отдельных процессов:
# Main process (Electron)
npm run dev:main

# Preload scripts
npm run dev:preload

# Renderer process (React)
npm run dev:renderer
```

### Сборка для production

```bash
# Сборка всех пакетов
npm run build

# Сборка и упаковка в исполняемый файл
npm run pack

```
Собранный лаунчер и его установщик появится в папке `./out` 


## ⚙️ Конфигурация

Настройки хранятся в файле `config.json` в корне проекта:

```json
{
  "launcher-name": "Custom Minecraft Launcher",
  "nickname": "Steve",
  "ram": 2048,
  "minecraft-path-name": ".minecraft"
}
```

## 📁 Структура проекта

```
Custom_minecraft_launcher/
├── packages/
│   ├── main/           # Electron main process
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── launch.ts
│   │   │   ├── downloadJava.ts
│   │   │   ├── createLauncherDir.ts
│   │   │   └── getConfigPath.ts
│   ├── renderer/       # React frontend
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── input.tsx
│   │   │   ├── inputRange.tsx
│   │   │   └── main.tsx
│   │   └── vite.config.ts
│   └── preload/        # Electron preload scripts
│       └── src/
│           └── index.ts
├── package.json
└── README.md
```

## 🎯 Использование

1. **Запустите приложение**
2. **Введите никнейм** в поле ввода
3. **Настройте RAM** с помощью слайдера (учитывается доступная память системы)
4. **Нажмите "Запустить Minecraft"**

Приложение автоматически:
- Скачает и установит Java 17, если необходимо
- Создаст директорию .minecraft
- Сохранит настройки
- Запустит Minecraft с указанными параметрами

## 🔧 Разработка

### Архитектура

- **Main Process** (Electron) - управление окнами, IPC, запуск Minecraft
- **Renderer Process** (React) - пользовательский интерфейс
- **Preload Scripts** - безопасная связь между процессами

### Добавление новых функций

1. Добавьте новые методы в `Window.launcherAPI` интерфейс
2. Реализуйте их в preload скрипте
3. Обработайте в main process через ipcMain.handle
4. Используйте в React компонентах

## 🐛 Известные проблемы



## 📄 Лицензия

MIT License

**Приятной игры! 🎮** 