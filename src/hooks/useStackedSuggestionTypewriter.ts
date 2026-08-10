import { useEffect, useMemo, useState } from 'react';

export interface StackedTypewriterOptions {
  enabled?: boolean;
  typeInterval?: number;
  pauseAfterLine?: number;
  pauseWhenFull?: number;
  startDelay?: number;
}

export interface StackedTypewriterResult {
  completedLines: readonly string[];
  activeLineIndex: number;
  activeText: string;
  showCursor: boolean;
}

export function useStackedSuggestionTypewriter(
  lines: readonly string[],
  options: StackedTypewriterOptions = {},
): StackedTypewriterResult {
  const {
    enabled = true,
    typeInterval = 34,
    pauseAfterLine = 420,
    pauseWhenFull = 3200,
    startDelay = 320,
  } = options;

  const safeLines = useMemo(
    () => (lines.length > 0 ? [...lines] : ['']),
    [lines],
  );

  const [completedLines, setCompletedLines] = useState<string[]>([]);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [started, setStarted] = useState(false);
  const [cycleKey, setCycleKey] = useState(0);

  useEffect(() => {
    setCompletedLines([]);
    setActiveLineIndex(0);
    setCharIndex(0);
    setAllDone(false);
    setStarted(false);
    setCycleKey((k) => k + 1);
  }, [safeLines]);

  useEffect(() => {
    if (!enabled) return;
    setStarted(false);
    const id = window.setTimeout(() => setStarted(true), startDelay);
    return () => window.clearTimeout(id);
  }, [enabled, cycleKey, startDelay]);

  useEffect(() => {
    if (!enabled || !started || allDone) return;

    const line = safeLines[activeLineIndex];
    if (!line) return;

    let timeout: number | undefined;

    if (charIndex < line.length) {
      timeout = window.setTimeout(() => setCharIndex((c) => c + 1), typeInterval);
    } else {
      timeout = window.setTimeout(() => {
        setCompletedLines((prev) => {
          const next = [...prev];
          next[activeLineIndex] = line;
          return next;
        });

        if (activeLineIndex < safeLines.length - 1) {
          setActiveLineIndex((i) => i + 1);
          setCharIndex(0);
        } else {
          setAllDone(true);
        }
      }, pauseAfterLine);
    }

    return () => {
      if (timeout != null) window.clearTimeout(timeout);
    };
  }, [
    activeLineIndex,
    allDone,
    charIndex,
    enabled,
    pauseAfterLine,
    safeLines,
    started,
    typeInterval,
  ]);

  useEffect(() => {
    if (!enabled || !allDone) return;
    const id = window.setTimeout(() => {
      setCompletedLines([]);
      setActiveLineIndex(0);
      setCharIndex(0);
      setAllDone(false);
      setCycleKey((k) => k + 1);
    }, pauseWhenFull);
    return () => window.clearTimeout(id);
  }, [allDone, enabled, pauseWhenFull]);

  if (!enabled) {
    return { completedLines: [], activeLineIndex: 0, activeText: '', showCursor: false };
  }

  const activeLine = safeLines[activeLineIndex] ?? '';
  const visibleActiveIndex = allDone ? safeLines.length : activeLineIndex;

  return {
    completedLines,
    activeLineIndex: visibleActiveIndex,
    activeText: allDone ? '' : activeLine.slice(0, charIndex),
    showCursor: started && !allDone,
  };
}
