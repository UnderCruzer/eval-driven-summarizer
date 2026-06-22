import { useEffect, useRef } from 'react'
import type { SSEEventType } from '../types'

export function useSSE(
  enabled: boolean,
  onEvent: (event: SSEEventType) => void,
) {
  const esRef = useRef<EventSource | null>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!enabled) {
      esRef.current?.close()
      esRef.current = null
      return
    }

    const es = new EventSource('/eval/stream')
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as SSEEventType
        onEventRef.current(ev)
      } catch {
        // ignore malformed events
      }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [enabled])
}
