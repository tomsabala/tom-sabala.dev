/**
 * The one theme switch for the main bundle — landing header, project pages and the admin
 * rail all render this. (`src/apps/ThemeToggle.tsx` is the apps bundle's own copy: that
 * entry must not pull in site components.)
 */
import { useTheme } from '../../contexts/ThemeContext.tsx';

const BASE =
  'bg-transparent border border-ln2 text-ink font-mono text-[12px] leading-none tracking-[0.06em] uppercase px-[11px] py-[9px] cursor-pointer hover:border-acct shrink-0';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme} aria-label="Toggle theme" className={`${BASE} ${className}`}>
      {theme === 'dark' ? '◐ Light' : '◑ Dark'}
    </button>
  );
}
