import { useTheme } from '../contexts/ThemeContext.tsx';

/**
 * Two shapes of the same control: the index header has room for a label, the frame header
 * (which also carries reload / open-in-new-tab) only for the glyph.
 */
function ThemeToggle({ variant = 'label' }: { variant?: 'label' | 'glyph' }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  const glyph = dark ? '◐' : '◑';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={
        variant === 'glyph'
          ? 'h-[34px] w-9 shrink-0 border border-ln2 bg-transparent font-mono text-sm leading-none text-ink hover:border-acct'
          : 'border border-ln2 bg-transparent px-[11px] py-[9px] font-mono text-xs uppercase leading-none tracking-[0.06em] text-ink hover:border-acct'
      }
    >
      {variant === 'glyph' ? glyph : `${glyph} ${dark ? 'Light' : 'Dark'}`}
    </button>
  );
}

export default ThemeToggle;
