type ChatSource = string | { name?: string; title?: string }

type StreamChatOptions = {
  threadId?: string
  baseUrl?: string
  signal?: AbortSignal
  onStatus?: (label: string) => void
  onSources?: (sources: ChatSource[]) => void
  onAnswer?: (text: string, cached: boolean) => void
  onDone?: (data: unknown) => void
  onError?: (message: string) => void
}

/** Streams the RAG backend's server-sent events for a chat message. */
export async function streamChat(message: string, options: StreamChatOptions = {}) {
  const { threadId, baseUrl = process.env.NEXT_PUBLIC_API_URL, signal, onStatus, onSources, onAnswer, onDone, onError } = options
  const payload: { message: string; thread_id?: string } = { message }
  if (threadId !== undefined) payload.thread_id = threadId

  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    onError?.('Could not reach the server. Please try again.')
    return
  }

  if (!response.ok) {
    onError?.(response.status === 429 ? 'Too many requests. Please wait a moment and try again.' : response.status === 422 ? 'Your message is empty or too long.' : 'Something went wrong. Please try again.')
    return
  }

  if (!response.body) {
    onError?.('The server returned an empty response.')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false

  const handleEvent = (name: string, data: Record<string, unknown>) => {
    if (name === 'status') onStatus?.(String(data.label ?? ''))
    if (name === 'sources') onSources?.((data.sources as ChatSource[]) ?? [])
    if (name === 'answer') onAnswer?.(String(data.text ?? ''), Boolean(data.cached))
    if (name === 'done') { finished = true; onDone?.(data) }
    if (name === 'error') { finished = true; onError?.(String(data.message ?? 'Something went wrong.')) }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let end = buffer.indexOf('\n\n')
      while (end !== -1) {
        const rawEvent = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        let name = 'message'
        const dataLines: string[] = []
        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('event:')) name = line.slice(6).trim()
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
        }
        if (dataLines.length) {
          try { handleEvent(name, JSON.parse(dataLines.join('\n')) as Record<string, unknown>) } catch { /* Ignore malformed events. */ }
        }
        end = buffer.indexOf('\n\n')
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    onError?.('Connection lost while waiting for the answer.')
    return
  }

  if (!finished && !signal?.aborted) onError?.('The connection closed before the answer finished.')
}

export type { ChatSource }
