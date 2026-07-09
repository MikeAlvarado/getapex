import { useCallback, useEffect, useRef, useState } from 'react'

export interface ElementSize {
  width: number
  height: number
}

export interface ResizeObserverResult extends ElementSize {
  /** Attach to the element to measure: `<div ref={ref}>`. */
  ref: (el: HTMLElement | null) => void
}

/**
 * Tracks the content-box size of whichever element `ref` is attached to.
 * A callback ref (rather than accepting a caller-owned `RefObject`) so
 * measurement starts the instant the element mounts — including when the
 * element's own render is gated behind data that arrives after this hook's
 * first call, which a `useEffect([someRefObject])` would miss entirely since
 * a ref object's identity never changes even as `.current` does.
 */
export function useResizeObserver(): ResizeObserverResult {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })
  const observerRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((el: HTMLElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    observer.observe(el)
    observerRef.current = observer
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  return { ref, ...size }
}
