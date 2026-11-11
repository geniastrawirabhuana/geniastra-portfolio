const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 8
const requests = new Map<string, number[]>()

export function allowTranslationRequest(userId: string, now = Date.now()) {
  for (const [id, timestamps] of requests) {
    const current = timestamps.filter((timestamp) => now - timestamp < WINDOW_MS)
    if (current.length) requests.set(id, current)
    else requests.delete(id)
  }
  const current = (requests.get(userId) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS)
  if (current.length >= MAX_REQUESTS_PER_WINDOW) {
    requests.set(userId, current)
    return false
  }
  requests.set(userId, [...current, now])
  return true
}

export function resetTranslationRateLimitForTests() {
  requests.clear()
}
