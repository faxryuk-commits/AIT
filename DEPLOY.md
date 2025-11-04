# Инструкция по деплою на Railway

## Шаг 1: Подготовка GitHub репозитория

1. Создайте новый репозиторий на GitHub
2. Закоммитьте код:

```bash
git init
git add .
git commit -m "Initial commit: AI-терапевт приложение"
git branch -M main
git remote add origin https://github.com/your-username/ai-therapist.git
git push -u origin main
```

## Шаг 2: Создание Telegram бота

1. Откройте Telegram и найдите [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям, чтобы создать бота
4. Сохраните токен бота (выглядит как `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. Для получения вашего Chat ID:
   - Найдите [@userinfobot](https://t.me/userinfobot) в Telegram
   - Начните диалог и получите ваш Chat ID

## Шаг 2.5: (Опционально) Настройка OpenAI для умных ответов

1. Зарегистрируйтесь на [platform.openai.com](https://platform.openai.com)
2. Перейдите в раздел API Keys
3. Создайте новый API ключ
4. Сохраните ключ (выглядит как `sk-...`)

> **Примечание:** Приложение работает и без OpenAI - используется fallback логика на основе правил CBT.

## Шаг 3: Деплой на Railway

### 3.1 Создание проекта на Railway

1. Перейдите на [Railway](https://railway.app)
2. Войдите через GitHub
3. Нажмите "New Project"
4. Выберите "Deploy from GitHub repo"
5. Выберите ваш репозиторий `ai-therapist`

### 3.2 Настройка переменных окружения

В Railway Dashboard перейдите в Settings → Variables и добавьте:

**Обязательные:**
```
TELEGRAM_BOT_TOKEN=ваш_токен_от_BotFather
```

**Опциональные:**
```
TELEGRAM_ADMIN_CHAT_ID=ваш_chat_id
OPENAI_API_KEY=ваш_openai_api_key
OPENAI_MODEL=gpt-4o-mini  # или gpt-4, gpt-3.5-turbo
```

Railway автоматически установит:
- `PORT` (обычно 3000)
- `RAILWAY_PUBLIC_DOMAIN` (ваш домен)

### 3.3 Настройка домена

1. В Railway Dashboard перейдите в Settings → Networking
2. Нажмите "Generate Domain" или используйте кастомный домен
3. Сохраните URL (например: `ai-therapist-production.up.railway.app`)

### 3.4 Установка Webhook для Telegram бота

После первого деплоя, настройте webhook:

```bash
# Установите переменную окружения
export TELEGRAM_BOT_TOKEN=ваш_токен
export WEBHOOK_URL=https://ваш-домен.railway.app

# Запустите скрипт настройки
npm run setup:telegram
```

Или вручную через curl:

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ваш-домен.railway.app/api/telegram/webhook"}'
```

### 3.5 Проверка работы

1. Проверьте, что приложение доступно: `https://ваш-домен.railway.app`
2. Проверьте health check: `https://ваш-домен.railway.app/api/health`
3. Напишите боту в Telegram: `/start`
4. Проверьте чат в веб-приложении - попробуйте написать сообщение

## Шаг 4: Автоматический деплой

Railway автоматически деплоит при каждом push в main ветку.

Для деплоя:
```bash
git add .
git commit -m "Your changes"
git push
```

## Мониторинг и логи

- **Логи**: Railway Dashboard → Deployments → View Logs
- **Метрики**: Railway Dashboard → Metrics
- **Telegram команды**:
  - `/status` - статус приложения
  - `/health` - проверка здоровья
  - `/users` - статистика пользователей
  - `/help` - справка по командам

## Стоимость OpenAI (если используется)

- GPT-4o-mini: ~$0.15 за 1M входных токенов, ~$0.60 за 1M выходных
- Типичный диалог: ~$0.001-0.005
- Можно настроить лимиты в OpenAI Dashboard

## Troubleshooting

### Бот не отвечает

1. Проверьте, что webhook установлен правильно:
```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

2. Проверьте логи в Railway Dashboard

3. Убедитесь, что переменные окружения установлены

### Приложение не запускается

1. Проверьте логи в Railway Dashboard
2. Убедитесь, что все зависимости установлены (`package.json`)
3. Проверьте, что `PORT` используется правильно (Next.js автоматически использует `PORT`)

### Ошибки при сборке

1. Убедитесь, что `next build` выполняется успешно локально
2. Проверьте версию Node.js (Railway использует последнюю LTS)

### OpenAI не работает

1. Проверьте, что `OPENAI_API_KEY` правильно установлен
2. Проверьте баланс на OpenAI аккаунте
3. Убедитесь, что модель доступна (`gpt-4o-mini`, `gpt-4`, `gpt-3.5-turbo`)
4. Проверьте логи в Railway - там будут ошибки API, если что-то не так
5. **Помните:** Приложение работает и без OpenAI, используя fallback логику

## Полезные ссылки

- [Railway Documentation](https://docs.railway.app)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
