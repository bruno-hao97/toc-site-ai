import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

export interface AnchorPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'down' | 'up';
}

/** Định vị panel theo trigger (fixed) + đóng khi click ngoài/Escape + reposition khi cuộn/resize. */
export function useAnchoredDropdown(open: boolean, setOpen: (v: boolean) => void) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<AnchorPos | null>(null);

  const updatePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const spaceAbove = r.top - 8;
    const placeUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(560, (placeUp ? spaceAbove : spaceBelow) - gap));
    setPos({
      left: r.left,
      width: r.width,
      top: placeUp ? r.top - gap : r.bottom + gap,
      maxHeight,
      placement: placeUp ? 'up' : 'down',
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePos();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, setOpen, updatePos]);

  return { triggerRef, panelRef, pos };
}

export function anchoredPanelStyle(
  pos: AnchorPos | null,
  minPanelWidth = 320,
): CSSProperties | undefined {
  if (!pos) return undefined;
  const effectiveWidth = Math.max(pos.width, minPanelWidth);
  const left = Math.max(8, Math.min(pos.left, window.innerWidth - effectiveWidth - 8));
  return {
    position: 'fixed',
    left,
    width: Math.max(pos.width, minPanelWidth),
    top: pos.top,
    maxHeight: pos.maxHeight,
    zIndex: 200,
    ...(pos.placement === 'up' ? { transform: 'translateY(-100%)' } : {}),
  };
}
