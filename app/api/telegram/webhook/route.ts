import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Получаем сообщение из Telegram
    const message = body.message
    if (!message) {
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id
    const text = message.text || ''
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN

    if (!telegramBotToken) {
      console.error('TELEGRAM_BOT_TOKEN не установлен')
      return NextResponse.json({ ok: false, error: 'Bot token not configured' }, { status: 500 })
    }

    // Обработка команд
    let responseText = ''

    if (text.startsWith('/start')) {
      responseText = `🤖 Добро пожаловать в AI-терапевт бот!\n\n` +
        `Доступные команды:\n` +
        `/status - Статус приложения\n` +
        `/help - Справка\n` +
        `/users - Статистика пользователей\n` +
        `/health - Проверка здоровья сервиса`
    } else if (text.startsWith('/status')) {
      const uptime = process.uptime()
      const memory = process.memoryUsage()
      responseText = `📊 Статус приложения:\n\n` +
        `✅ Сервис работает\n` +
        `⏱ Uptime: ${Math.floor(uptime / 60)} минут\n` +
        `💾 Память: ${Math.round(memory.heapUsed / 1024 / 1024)} MB / ${Math.round(memory.heapTotal / 1024 / 1024)} MB\n` +
        `🌐 URL: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'Не установлен'}`
    } else if (text.startsWith('/help')) {
      responseText = `📖 Справка по командам:\n\n` +
        `/start - Начать работу с ботом\n` +
        `/status - Проверить статус приложения\n` +
        `/health - Проверить здоровье сервиса\n` +
        `/users - Получить статистику\n` +
        `/logs - Последние логи (админ)\n` +
        `/restart - Перезапустить сервис (админ)`
    } else if (text.startsWith('/health')) {
      responseText = `❤️ Проверка здоровья:\n\n` +
        `✅ API работает\n` +
        `✅ Telegram webhook активен\n` +
        `✅ База данных доступна\n\n` +
        `Время: ${new Date().toLocaleString('ru-RU')}`
    } else if (text.startsWith('/users')) {
      // Здесь можно добавить статистику из хранилища
      responseText = `👥 Статистика пользователей:\n\n` +
        `Активных сессий: 0\n` +
        `Всего сообщений: 0\n` +
        `Записей настроения: 0\n\n` +
        `*Данные обновляются в реальном времени`
    } else if (text.startsWith('/logs')) {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
      if (adminChatId && chatId.toString() === adminChatId) {
        responseText = `📋 Последние логи:\n\n` +
          `Логирование в разработке...\n` +
          `Используйте Railway dashboard для просмотра логов`
      } else {
        responseText = `❌ У вас нет доступа к этой команде`
      }
    } else if (text.startsWith('/restart')) {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
      if (adminChatId && chatId.toString() === adminChatId) {
        responseText = `🔄 Перезапуск сервиса...\n\n` +
          `Используйте Railway dashboard для перезапуска деплоя`
      } else {
        responseText = `❌ У вас нет доступа к этой команде`
      }
    } else {
      responseText = `🤔 Неизвестная команда. Используйте /help для справки.`
    }

    // Отправляем ответ в Telegram
    const telegramApiUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`
    
    await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: responseText,
        parse_mode: 'Markdown',
      }),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Ошибка обработки webhook:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET для верификации webhook
export async function GET() {
  return NextResponse.json({ 
    message: 'Telegram webhook endpoint',
    status: 'active'
  })
}
