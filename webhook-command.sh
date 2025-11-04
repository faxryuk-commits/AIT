#!/bin/bash
# Команда для настройки webhook с доменом ait-production-b8ee.up.railway.app
# ЗАМЕНИТЕ ВАШ_ТОКЕН на токен от BotFather

echo "🔧 Настройка webhook для EmotiCare"
echo ""
echo "Ваш домен: ait-production-b8ee.up.railway.app"
echo ""
echo "Замените ВАШ_ТОКЕН в команде ниже и выполните:"
echo ""
echo "curl -X POST \"https://api.telegram.org/botВАШ_ТОКЕН/setWebhook\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"url\": \"https://ait-production-b8ee.up.railway.app/api/telegram/webhook\"}'"
echo ""
echo "Или откройте в браузере:"
echo ""
echo "https://api.telegram.org/botВАШ_ТОКЕН/setWebhook?url=https://ait-production-b8ee.up.railway.app/api/telegram/webhook"
