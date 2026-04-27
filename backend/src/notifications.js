export async function sendTelegramTestAlert(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    return {
      sent: false,
      mode: 'mock',
      message:
        'Telegram не настроен. Добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в backend/.env.',
    }
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Telegram API error: ${response.status} ${text}`)
  }

  return {
    sent: true,
    mode: 'live',
    message: 'Тестовое уведомление отправлено в Telegram.',
  }
}
