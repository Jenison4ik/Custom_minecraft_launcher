### Установка серверной части

Клонируем только серверную директорию `server_app` одной командой:

```bash
git clone --filter=blob:none --sparse https://github.com/Jenison4ik/Custom_minecraft_launcher.git && cd Custom_minecraft_launcher && git sparse-checkout set server_app
```
Преред первым запуском, необходимо выдать себе первый SSL сертификат командой
```bash
docker compose run --rm --entrypoint "" certbot certbot certonly --webroot \
  -w /var/www/certbot \
  -d your-domain.com -d www.your-domain.com \
  --email your-mail@email.com \
  --agree-tos --no-eff-email -v
```

поля your-domain.com и your-mail@email.com, необходимо заменить на соответсвующие