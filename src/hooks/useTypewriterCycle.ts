import { useEffect, useState } from 'react';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => prefersReducedMotion());

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return reduced;
}

export interface TypewriterCycleOptions {
  enabled?: boolean;
  typeInterval?: number;
  eraseInterval?: number;
  pauseAfterType?: number;
  pauseAfterErase?: number;
}

export interface TypewriterCycleResult {
  text: string;
  showCursor: boolean;
  phraseIndex: number;
}

export function useTypewriterCycle(
  phrases: readonly string[],
  options: TypewriterCycleOptions = {},
): TypewriterCycleResult {
  const {
    enabled = true,
    typeInterval = 38,
    eraseInterval = 22,
    pauseAfterType = 2400,
    pauseAfterErase = 320,
  } = options;

  const reducedMotion = useReducedMotion();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'erasing'>('typing');

  const safePhrases = phrases.length > 0 ? phrases : [''];
  const activePhrase = safePhrases[phraseIndex % safePhrases.length] ?? '';

  useEffect(() => {
    setPhraseIndex(0);
    setCharIndex(0);
    setPhase('typing');
  }, [phrases]);

  useEffect(() => {
    if (!enabled) return;
    setCharIndex(0);
    setPhase('typing');
  }, [enabled, phraseIndex]);

  useEffect(() => {
    if (!enabled || !reducedMotion) return;
    const id = window.setInterval(() => {
      setPhraseIndex((i) => (i + 1) % safePhrases.length);
    }, pauseAfterType + pauseAfterErase);
    return () => window.clearInterval(id);
  }, [enabled, pauseAfterErase, pauseAfterType, reducedMotion, safePhrases.length]);

  useEffect(() => {
    if (!enabled || reducedMotion) return;

    let timeout: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (charIndex < activePhrase.length) {
        timeout = setTimeout(() => setCharIndex((c) => c + 1), typeInterval);
      } else {
        timeout = setTimeout(() => setPhase('erasing'), pauseAfterType);
      }
    } else if (charIndex > 0) {
      timeout = setTimeout(() => setCharIndex((c) => c - 1), eraseInterval);
    } else {
      timeout = setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % safePhrases.length);
        setPhase('typing');
      }, pauseAfterErase);
    }

    return () => clearTimeout(timeout);
  }, [
    activePhrase,
    charIndex,
    enabled,
    eraseInterval,
    pauseAfterErase,
    pauseAfterType,
    phase,
    reducedMotion,
    safePhrases.length,
    typeInterval,
  ]);

  if (!enabled) {
    return { text: '', showCursor: false, phraseIndex: 0 };
  }

  if (reducedMotion) {
    return {
      text: activePhrase,
      showCursor: false,
      phraseIndex: phraseIndex % safePhrases.length,
    };
  }

  return {
    text: activePhrase.slice(0, charIndex),
    showCursor: phase === 'typing',
    phraseIndex: phraseIndex % safePhrases.length,
  };
}
