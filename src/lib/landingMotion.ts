import { useReducedMotion, type Variants } from 'framer-motion';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function useLandingMotion() {
  const reduced = useReducedMotion();

  const stagger: Variants = reduced
    ? {
        hidden: { opacity: 1 },
        show: { opacity: 1 },
      }
    : {
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: 0.08, delayChildren: 0.06 },
        },
      };

  const staggerItem: Variants = reduced
    ? {
        hidden: { opacity: 1 },
        show: { opacity: 1 },
      }
    : {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
      };

  return {
    reduced: Boolean(reduced),
    heroCopy: reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
      : {
          initial: { opacity: 0, y: 22 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, ease: EASE_OUT },
        },
    heroShot: reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15, delay: 0.05 } }
      : {
          initial: { opacity: 0, y: 28 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.65, ease: EASE_OUT, delay: 0.12 },
        },
    stagger,
    staggerItem,
  };
}
