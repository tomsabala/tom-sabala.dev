import { useEffect, useState } from 'react';
import { getAllCommands } from '../commands/registry';
import { themes } from '../themes';

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

interface WelcomeBannerProps {
  /** Only claim a rover is scanning when the pane is actually mounted. */
  lidarVisible: boolean;
}

export default function WelcomeBanner({ lidarVisible }: WelcomeBannerProps) {
  const [isSmall, setIsSmall] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsSmall(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const commandCount = getAllCommands().length;

  return (
    <div className="terminal-banner" aria-label="Welcome banner">
      <pre className="terminal-banner-art">{isSmall ? BANNER_SMALL : BANNER_FULL}</pre>
      <div className="terminal-banner-subtitle">
        Full-Stack Software Engineer &middot; robotics &amp; geometry nerd
      </div>
      <div className="terminal-banner-meta">
        v3.0 &middot; {commandCount} commands &middot; {themes.length} themes
        {lidarVisible && ' · a LiDAR rover is scanning the room on the right'}
      </div>
      <div className="terminal-banner-separator">{'─'.repeat(isSmall ? 30 : 56)}</div>
      <div>
        Type '<span className="terminal-banner-cmd">help</span>' to get started, or tap a chip below.
      </div>
    </div>
  );
}
