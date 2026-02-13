import { useEffect, useRef } from 'react';

const KONAMI_SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

const TIMEOUT_MS = 2000;

export function useKonamiCode(onActivate: () => void) {
  const indexRef = useRef(0);
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();

      if (indexRef.current > 0 && now - lastKeyTimeRef.current > TIMEOUT_MS) {
        indexRef.current = 0;
      }

      lastKeyTimeRef.current = now;
      const expected = KONAMI_SEQUENCE[indexRef.current];

      if (e.key === expected || e.key.toLowerCase() === expected) {
        indexRef.current++;
        if (indexRef.current === KONAMI_SEQUENCE.length) {
          indexRef.current = 0;
          onActivate();
        }
      } else {
        indexRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onActivate]);
}
