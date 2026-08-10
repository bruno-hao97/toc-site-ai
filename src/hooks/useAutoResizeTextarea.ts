import { useCallback, useLayoutEffect, type RefObject } from 'react';

const MAX_HEIGHT_PX = 280;

export function useAutoResizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  minRows = 1,
) {
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const style = getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || 21;
    const pad =
      (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const minHeight = lineHeight * minRows + pad;
    const scroll = el.scrollHeight;
    const next = Math.min(Math.max(scroll, minHeight), MAX_HEIGHT_PX);
    el.style.height = `${next}px`;
    el.style.overflowY = scroll > MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, [ref, minRows]);

  useLayoutEffect(() => {
    resize();
  }, [value, resize]);

  return resize;
}
