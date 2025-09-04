### Установка серверной части

Клонируем только серверную директорию `server_app` одной командой:

```bash
git clone --filter=blob:none --sparse https://github.com/Jenison4ik/Custom_minecraft_launcher.git && cd Custom_minecraft_launcher && git sparse-checkout set server_app
