import { useCallback, useEffect, useRef, useState } from 'react';
import Terminal from './components/Terminal';
import TerminalOutput from './components/TerminalOutput';
import TerminalInput from './components/TerminalInput';
import WelcomeBanner from './components/WelcomeBanner';
import CommandSuggestions from './components/CommandSuggestions';
import LidarPane from './components/LidarPane';
import { useTerminal } from './hooks/useTerminal';
import { useTheme } from './hooks/useTheme';
import { useKonamiCode } from './hooks/useKonamiCode';
import { getPrompt } from './constants';
import { populateProjects } from './filesystem';
import { getPortfolio } from '../repositories/portfolioRepository';
import { ACCENT, DIM } from './commands/output';
import type { ProjectsSnapshot } from './commands/types';
import './commands/clear';
import './commands/help';
import './commands/about';
import './commands/cat';
import './commands/contact';
import './commands/download';
import './commands/open';
import './commands/history';
import './commands/theme';
import './commands/sudo';
import './commands/whoami';
import './commands/cd';
import './commands/ls';
import './commands/pwd';
import './commands/stats';
import './commands/projects';
import './commands/apps';
import './commands/field';

/** The LiDAR pane needs the horizontal room; below this it is not rendered at all. */
const WIDE_QUERY = '(min-width: 900px)';

export default function TerminalApp() {
  const { currentTheme, setTheme, setContainerRef } = useTheme();

  const currentThemeName = useCallback(() => currentTheme.name, [currentTheme]);

  const [fieldOn, setFieldOn] = useState(true);
  const [fieldResetSignal, setFieldResetSignal] = useState(0);
  const [isWide, setIsWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);

  const fieldOnRef = useRef(fieldOn);
  fieldOnRef.current = fieldOn;

  const projectsRef = useRef<ProjectsSnapshot>({ status: 'loading' });

  const getProjects = useCallback(() => projectsRef.current, []);
  const isFieldVisible = useCallback(() => fieldOnRef.current, []);
  const resetField = useCallback(() => setFieldResetSignal(n => n + 1), []);

  const {
    outputHistory,
    currentInput,
    setCurrentInput,
    isProcessing,
    handleKeyDown,
    executeCommand,
    addOutput,
    inputRef,
    currentDir,
    filesystem,
  } = useTerminal({
    setTheme,
    currentThemeName,
    getProjects,
    setFieldVisible: setFieldOn,
    isFieldVisible,
    resetField,
  });

  // One fetch per session: the `projects` command and the `projects/` directory read the
  // same snapshot, so a failed request leaves the directory empty rather than half-built.
  useEffect(() => {
    let cancelled = false;
    getPortfolio()
      .then(resp => {
        if (cancelled) return;
        const items = Array.isArray(resp?.data) ? resp.data : [];
        projectsRef.current = { status: 'ready', items };
        populateProjects(filesystem, items);
      })
      .catch(() => {
        if (!cancelled) projectsRef.current = { status: 'unavailable' };
      });
    return () => { cancelled = true; };
  }, [filesystem]);

  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = () => setIsWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const clockRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tick = () => {
      if (clockRef.current) clockRef.current.textContent = new Date().toTimeString().slice(0, 8);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, []);

  const handleKonami = useCallback(() => {
    addOutput({
      lines: [
        { text: '' },
        { text: '  \u2191 \u2191 \u2193 \u2193 \u2190 \u2192 \u2190 \u2192 B A', bold: true, color: ACCENT },
        { text: '' },
        { text: '  You found the secret!', bold: true },
        { text: '  Switching to Dracula theme...', color: DIM },
        { text: '' },
      ],
    });
    setTheme('dracula');
  }, [addOutput, setTheme]);

  useKonamiCode(handleKonami);

  const lidarVisible = fieldOn && isWide;

  return (
    <div className="terminal-shell" ref={setContainerRef}>
      <header className="terminal-statusbar">
        <div className="terminal-statusbar-group">
          <span className="terminal-statusbar-brand">[0] tom-sabala.dev</span>
          <span className="terminal-statusbar-cwd">{currentDir}</span>
          <a className="terminal-statusbar-link" href="/">&#8599; gui</a>
        </div>
        <div className="terminal-statusbar-group terminal-statusbar-group--right">
          <span className="terminal-statusbar-cell">theme:{currentTheme.name}</span>
          <span className="terminal-statusbar-cell">field:{fieldOn ? 'lidar' : 'off'}</span>
          <span className="terminal-statusbar-cell terminal-statusbar-clock" ref={clockRef}>
            --:--:--
          </span>
        </div>
      </header>

      <div className="terminal-body">
        <Terminal inputRef={inputRef} outputHistory={outputHistory}>
          <WelcomeBanner lidarVisible={lidarVisible} />
          <TerminalOutput outputHistory={outputHistory} />
          <TerminalInput
            prompt={getPrompt(currentDir)}
            currentInput={currentInput}
            onInputChange={setCurrentInput}
            onKeyDown={handleKeyDown}
            inputRef={inputRef}
            isProcessing={isProcessing}
          />
        </Terminal>
        {lidarVisible && <LidarPane resetSignal={fieldResetSignal} />}
      </div>

      <footer className="terminal-chipbar">
        <CommandSuggestions onExecute={executeCommand} isProcessing={isProcessing} />
        <span className="terminal-chipbar-hint">
          TAB complete &middot; &#8593;&#8595; history &middot; &#8593;&#8593;&#8595;&#8595;&#8592;&#8594;&#8592;&#8594;BA
        </span>
      </footer>
    </div>
  );
}
