const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
])

function getBackendBaseUrl() {
  const fromEnv =
    process.env.API_BASE_URL || process.env.BACKEND_URL || process.env.VITE_API_BASE_URL || ''
  return fromEnv.replace(/\/+$/, '').replace(/\/api$/i, '')
}

function buildForwardHeaders(headers = {}) {
  const result = {}
  for (const [name, value] of Object.entries(headers)) {
    if (!value) continue
    const key = String(name).toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(key)) continue
    result[name] = value
  }
  return result
}

function extractApiPath(eventPath = '') {
  const trimmed = eventPath.replace(/^\/\.netlify\/functions\/api\/?/, '')
  if (!trimmed) return '/api'
  return `/api/${trimmed}`
}

exports.handler = async (event) => {
  const backendBaseUrl = getBackendBaseUrl()
  if (!backendBaseUrl) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        message:
          'Backend URL is not configured. Set Netlify env variable API_BASE_URL (or BACKEND_URL).',
      }),
    }
  }

  const apiPath = extractApiPath(event.path)
  const query = event.rawQuery ? `?${event.rawQuery}` : ''
  const targetUrl = `${backendBaseUrl}${apiPath}${query}`

  const method = event.httpMethod || 'GET'
  const bodyAllowed = !['GET', 'HEAD'].includes(method.toUpperCase())

  let requestBody
  if (bodyAllowed && typeof event.body === 'string') {
    requestBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body
  }

  try {
    const response = await fetch(targetUrl, {
      method,
      headers: buildForwardHeaders(event.headers),
      body: requestBody,
    })

    const responseBody = await response.text()
    const contentType = response.headers.get('content-type')
    const contentDisposition = response.headers.get('content-disposition')

    const responseHeaders = {}
    if (contentType) responseHeaders['content-type'] = contentType
    if (contentDisposition) responseHeaders['content-disposition'] = contentDisposition

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
    }
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        message: 'API proxy request failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
