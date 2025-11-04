import { NextRequest, NextResponse } from 'next/server'

/**
 * Автоматическая настройка webhook
 * Этот endpoint использует токен из переменных окружения Railway
 * 
 * Использование:
 * GET https://ваш-домен.railway.app/api/telegram/setup
 */
export async function GET(request: NextRequest) {
  try {
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || request.headers.get('host')

    if (!telegramBotToken) {
      return NextResponse.json({
        success: false,
        error: 'TELEGRAM_BOT_TOKEN не установлен в Railway переменных окружения',
        instructions: [
          '1. Откройте Railway Dashboard → Settings → Variables',
          '2. Добавьте переменную: TELEGRAM_BOT_TOKEN=ваш_токен',
          '3. Перезапустите деплой',
          '4. Попробуйте снова'
        ]
      }, { status: 500 })
    }

    if (!railwayDomain) {
      return NextResponse.json({
        success: false,
        error: 'Не удалось определить домен Railway'
      }, { status: 500 })
    }

    // Формируем webhook URL
    const webhookUrl = railwayDomain.startsWith('http') 
      ? `${railwayDomain}/api/telegram/webhook`
      : `https://${railwayDomain}/api/telegram/webhook`

    console.log(`🔧 Настройка webhook для EmotiCare...`)
    console.log(`📍 URL: ${webhookUrl}`)

    // Настраиваем webhook через Telegram API
    const response = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/setWebhook`,
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
      // Получаем информацию о webhook для подтверждения
      const infoResponse = await fetch(
        `https://api.telegram.org/bot${telegramBotToken}/getWebhookInfo`
      )
      const info = await infoResponse.json()

      return NextResponse.json({
        success: true,
        message: 'Webhook успешно настроен!',
        webhookUrl: webhookUrl,
        webhookInfo: info.result,
        nextSteps: [
          'Откройте Telegram и найдите вашего бота',
          'Отправьте команду /start',
          'EmotiCare готов помочь! 💙'
        ]
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Ошибка при настройке webhook',
        telegramError: data.description,
        errorCode: data.error_code
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Ошибка настройки webhook:', error)
    return NextResponse.json({
      success: false,
      error: 'Внутренняя ошибка сервера',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
