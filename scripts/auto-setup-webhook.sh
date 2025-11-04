#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   EmotiCare - Автоматическая настройка Webhook"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Домен из Railway
DOMAIN="ait-production-b8ee.up.railway.app"
WEBHOOK_URL="https://${DOMAIN}/api/telegram/webhook"

echo "📍 Домен: $DOMAIN"
echo ""

# Запрашиваем токен
read -p "🤖 Введите токен бота от BotFather: " BOT_TOKEN

if [ -z "$BOT_TOKEN" ]; then
  echo "❌ Ошибка: Токен не может быть пустым"
  exit 1
fi

echo ""
echo "🔧 Настраиваю webhook..."

# Настраиваем webhook
RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\"}")

# Проверяем ответ
if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Webhook успешно установлен!"
  echo ""
  
  # Получаем информацию о webhook
  echo "🔍 Проверяю webhook..."
  INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
  
  echo ""
  echo "📋 Статус webhook:"
  echo "$INFO" | grep -o '"url":"[^"]*"' | sed 's/"url":"/   URL: /' | sed 's/"//'
  
  echo ""
  echo "🎉 Готово! Теперь можете протестировать бота в Telegram."
  echo "   Отправьте боту команду /start"
else
  echo "❌ Ошибка при настройке webhook:"
  echo "$RESPONSE"
  exit 1
fi
