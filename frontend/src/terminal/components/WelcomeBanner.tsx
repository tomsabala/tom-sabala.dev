import { useEffect, useState } from 'react';
import { PERSONAL_INFO } from '../data';

const BANNER_FULL = `
 _____                  ____        _           _
|_   _|___  _ __ ___   / ___|  __ _| |__   __ _| | __ _
  | | / _ \\| '_ \` _ \\  \\___ \\ / _\` | '_ \\ / _\` | |/ _\` |
  | || (_) | | | | | |  ___) | (_| | |_) | (_| | | (_| |
  |_| \\___/|_| |_| |_| |____/ \\__,_|_.__/ \\__,_|_|\\__,_|
`.trimStart();

const BANNER_SMALL = `
 _____ ___
|_   _/ __|
  | | \\__ \\
  |_| |___/
`.trimStart();

export default function WelcomeBanner() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const banner = isMobile ? BANNER_SMALL : BANNER_FULL;

  return (
    <div className="terminal-banner" aria-label="Welcome banner">
      <pre className="terminal-banner-art">{banner}</pre>
      <div className="terminal-banner-subtitle">{PERSONAL_INFO.title}</div>
      <div className="terminal-banner-hint">
        Type '<span className="terminal-banner-cmd">help</span>' to get started.
      </div>
      <div className="terminal-banner-spacer" />
    </div>
  );
}
