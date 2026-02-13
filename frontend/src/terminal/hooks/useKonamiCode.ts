import { useEffect, useRef } from 'react';

const KONAMI_SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

export function useKonamiCode(onActivate: () => void) {
  const indexRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
