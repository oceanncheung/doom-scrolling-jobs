'use client'

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
} from 'react'

export type AutoSizeTextareaProps = Omit<ComponentPropsWithoutRef<'textarea'>, 'rows'> & {
  /** Sync height when this changes (e.g. profile reset from server). */
  value: string
}

/**
 * Controlled textarea whose block height follows `scrollHeight` so the field hugs the text
 * instead of a fixed min block (used for job search brief + professional summary).
 */
export const AutoSizeTextarea = forwardRef<HTMLTextAreaElement, AutoSizeTextareaProps>(
  function AutoSizeTextarea({ value, onChange, ...rest }, forwardedRef) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null)

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node
        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef) {
          forwardedRef.current = node
        }
      },
      [forwardedRef],
    )

    const syncHeight = useCallback(() => {
      const el = innerRef.current
      if (!el) return
      // Collapse first so scrollHeight measures content + padding (needs min-height:0 in CSS).
      // Do not trim: preserve the same bottom padding as `.field input` (padding-bottom + border).
      el.style.height = '0px'
      el.style.height = `${el.scrollHeight}px`
    }, [])

    useLayoutEffect(() => {
      syncHeight()
    }, [value, syncHeight])

    return (
      <textarea
        ref={setRefs}
        rows={1}
        {...rest}
        value={value}
        onChange={onChange}
      />
    )
  },
)
