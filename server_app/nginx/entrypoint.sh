#!/bin/sh
set -e

# Используем переменную окружения напрямую
CONFIG_TEMPLATE="/etc/nginx/templates/nginx.conf.template"
INIT_CONFIG_TEMPLATE="/etc/nginx/templates/nginx-init.conf.template"
NGINX_CONFIG="/etc/nginx/nginx.conf"

# Формируем пути к сертификатам (DOMAIN берется из переменной окружения)
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

# Проверяем наличие сертификатов
if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
    echo "✅ SSL сертификаты найдены, используем полную конфигурацию с HTTPS"
    envsubst '${DOMAIN}' < "$CONFIG_TEMPLATE" > "$NGINX_CONFIG"
else
    echo "⚠️  SSL сертификаты НЕ найдены, используем начальную конфигурацию без HTTPS"
    echo "   Для получения сертификатов выполните: docker-compose --profile init run --rm certbot-init"
    envsubst '${DOMAIN}' < "$INIT_CONFIG_TEMPLATE" > "$NGINX_CONFIG"
fi

# Проверяем конфигурацию nginx
echo "Проверка конфигурации nginx..."
nginx -t

# Запускаем nginx
echo "Запуск nginx..."
exec nginx -g 'daemon off;'

