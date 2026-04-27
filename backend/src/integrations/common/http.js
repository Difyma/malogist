export class HttpError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.payload = payload
  }
}

async function safeParseJson(response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  const payload = await safeParseJson(response)

  if (!response.ok) {
    const ozonMsg =
      payload && typeof payload === 'object' && typeof payload.message === 'string'
        ? payload.message
        : null
    const detail = ozonMsg ? `: ${ozonMsg}` : ''
    throw new HttpError(`HTTP ${response.status} on ${url}${detail}`, response.status, payload)
  }

  return payload
}

export function isoDateDaysAgo(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}
