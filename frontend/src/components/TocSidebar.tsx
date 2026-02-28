import { useEffect, useState } from 'react';

interface TocItem {
  level: number;
  text: string;
  id: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-');
}

function parseHeadings(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  for (const line of markdown.split('\n')) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;
    const text = match[2]
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
    items.push({ level: match[1].length, text, id: slugify(text) });
  }
  return items;
}

interface TocSidebarProps {
  projectName: string;
  markdown: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

function TocSidebar({ projectName, markdown, contentRef }: TocSidebarProps) {
  const [activeId, setActiveId] = useState<string>('');
  const items = parseHeadings(markdown);
  const minLevel = items.length > 0 ? Math.min(...items.map(i => i.level)) : 1;

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    // Wait one tick for ReactMarkdown to finish rendering
    const timer = setTimeout(() => {
      const headings = el.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings.length === 0) return;

      const observer = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setActiveId(entry.target.id);
              break;
            }
          }
        },
        { rootMargin: '-10% 0% -80% 0%', threshold: 0 }
      );

      headings.forEach(h => observer.observe(h));
      return () => observer.disconnect();
    }, 100);

    return () => clearTimeout(timer);
  }, [contentRef, markdown]);

  if (items.length === 0) return null;

  return (
    <aside className="hidden lg:block w-56 shrink-0">
      <div className="sticky top-8">
        {/* Project name */}
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 truncate">
          {projectName}
        </div>
        <div className="w-full h-px bg-gray-200 dark:bg-gray-700 mb-3" />

        {/* Heading tree */}
        <nav className="space-y-0.5">
          {items.map((item, i) => {
            const indent = (item.level - minLevel) * 10;
            const isActive = activeId === item.id;
            return (
              <a
                key={i}
                href={`#${item.id}`}
                style={{ paddingLeft: `${indent}px` }}
                className={`block text-xs py-0.5 leading-5 truncate transition-colors ${
                  isActive
                    ? 'text-[hsl(210,65%,60%)] font-medium'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {item.text}
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export default TocSidebar;
