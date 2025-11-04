#!/usr/bin/env ts-node

/**
 * Скрипт для настройки Telegram бота
 * Использование: npx ts-node scripts/setup-telegram-bot.ts
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_URL = process.env.WEBHOOK_URL || process.env.RAILWAY_PUBLIC_DOMAIN

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN не установлен в переменных окружения')
  process.exit(1)
}

if (!WEBHOOK_URL) {
  console.error('❌ WEBHOOK_URL не установлен. Укажите полный URL вашего приложения')
  process.exit(1)
}

const webhookUrl = WEBHOOK_URL.startsWith('http') 
  ? `${WEBHOOK_URL}/api/telegram/webhook`
  : `https://${WEBHOOK_URL}/api/telegram/webhook`

async function setupWebhook() {
  try {
    console.log('🔧 Настройка Telegram webhook...')
    console.log(`📍 URL: ${webhookUrl}`)

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
      const infoResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
      )
      const info = await infoResponse.json()
      
      if (info.ok) {
        console.log('\n📋 Информация о webhook:')
        console.log(JSON.stringify(info.result, null, 2))
      }
    } else {
      console.error('❌ Ошибка установки webhook:', data.description)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Ошибка:', error)
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
      console.log('\n🤖 Информация о боте:')
      console.log(`Имя: ${data.result.first_name}`)
      console.log(`Username: @${data.result.username}`)
      console.log(`ID: ${data.result.id}`)
    }
  } catch (error) {
    console.error('❌ Ошибка получения информации о боте:', error)
  }
}

async function main() {
  await getBotInfo()
  await setupWebhook()
}

main()
