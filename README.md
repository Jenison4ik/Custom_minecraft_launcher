# Custom Minecraft Launcher

`Лаунчер находится в стадии активной разработке, это предварительная версия README.md `

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
# Запуск Vite dev server для React
cd packages/renderer
npm run dev

# В другом терминале - запуск Electron
cd packages/main
npm run dev
```

### Сборка для production

```bash
# Сборка всех пакетов
npm run build

# Запуск production версии
npm start
```

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
│   │   │   └── createLauncherDir.ts
│   ├── renderer/       # React frontend
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── input.tsx
│   │   │   └── inputRange.tsx
│   └── preload/        # Electron preload scripts
│       └── src/
│           └── index.ts
├── config.json
└── package.json
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

- При первом запуске может потребоваться время для скачивания Java
- Убедитесь, что Vite dev server запущен перед запуском Electron в режиме разработки

## 📄 Лицензия

MIT License

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Создайте Pull Request

---

**Приятной игры! 🎮** 