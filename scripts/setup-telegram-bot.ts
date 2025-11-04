#!/usr/bin/env ts-node

/**
 * Скрипт для настройки Telegram бота
 * Использование: 
 *   npx ts-node scripts/setup-telegram-bot.ts
 *   или
 *   npm run setup:telegram
 * 
 * Требует переменные окружения:
 *   TELEGRAM_BOT_TOKEN - токен от BotFather
 *   WEBHOOK_URL - URL вашего приложения (или RAILWAY_PUBLIC_DOMAIN)
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_URL = process.env.WEBHOOK_URL || process.env.RAILWAY_PUBLIC_DOMAIN

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ ОШИБКА: TELEGRAM_BOT_TOKEN не установлен')
  console.error('\nУстановите переменную окружения:')
  console.error('  export TELEGRAM_BOT_TOKEN=ваш_токен_от_BotFather')
  console.error('\nИли создайте файл .env.local с:')
  console.error('  TELEGRAM_BOT_TOKEN=ваш_токен')
  process.exit(1)
}

if (!WEBHOOK_URL) {
  console.error('❌ ОШИБКА: WEBHOOK_URL не установлен')
  console.error('\nУстановите переменную окружения:')
  console.error('  export WEBHOOK_URL=https://ваш-домен.railway.app')
  console.error('\nИли используйте RAILWAY_PUBLIC_DOMAIN:')
  console.error('  export RAILWAY_PUBLIC_DOMAIN=ваш-домен.railway.app')
  process.exit(1)
}

// Формируем полный URL webhook
const webhookUrl = WEBHOOK_URL.startsWith('http') 
  ? `${WEBHOOK_URL}/api/telegram/webhook`
  : `https://${WEBHOOK_URL}/api/telegram/webhook`

async function setupWebhook() {
  try {
    console.log('🔧 Настройка Telegram webhook для EmotiCare...')
    console.log(`📍 URL: ${webhookUrl}\n`)

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message'],
        }),
      }
    )

    const data = await response.json()

    if (data.ok) {
      console.log('✅ Webhook успешно установлен!')
      
      // Проверяем информацию о webhook
      console.log('\n🔍 Проверка webhook...')
      const infoResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
      )
      const info = await infoResponse.json()
      
      if (info.ok) {
        console.log('\n📋 Информация о webhook:')
        console.log(`   URL: ${info.result.url}`)
        console.log(`   Ожидает подтверждения: ${info.result.pending_update_count} обновлений`)
        if (info.result.last_error_date) {
          console.log(`   ⚠️  Последняя ошибка: ${info.result.last_error_message}`)
        } else {
          console.log(`   ✅ Нет ошибок`)
        }
      }
      
      console.log('\n🎉 Готово! Теперь можете протестировать бота в Telegram.')
      console.log('   Отправьте боту команду /start')
    } else {
      console.error('❌ Ошибка установки webhook:', data.description)
      if (data.error_code) {
        console.error(`   Код ошибки: ${data.error_code}`)
      }
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Ошибка:', error)
    if (error instanceof Error) {
      console.error(`   ${error.message}`)
    }
    process.exit(1)
  }
}

async function getBotInfo() {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`
    )
    const data = await response.json()
    
    if (data.ok) {
      console.log('🤖 Информация о боте:')
      console.log(`   Имя: ${data.result.first_name}`)
      console.log(`   Username: @${data.result.username}`)
      console.log(`   ID: ${data.result.id}\n`)
    }
  } catch (error) {
    console.warn('⚠️  Не удалось получить информацию о боте')
  }
}

// Запуск
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('   EmotiCare - Настройка Telegram Webhook')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  await getBotInfo()
  await setupWebhook()
}

main()
