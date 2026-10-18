/**
 * Deep-dive renderer for a project's `deep-dive.md`.
 *
 * The markdown pipeline is unchanged from the pre-redesign detail page — `rehypeRaw`,
 * `rehypeSlug`, the newline-trimming plugin, `rehypeHighlight`, `remarkGfm`, the relative
 * image rewrite and the line-numbered code renderer. What changed is where the table of
 * contents lives: it is local state here (a sticky column at `xl`, a `<details>` disclosure
 * below that) instead of a page-wide context.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, ReactElement } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { Root, Element } from 'hast';

export interface TocItem {
  id: string;
  label: string;
  children?: TocItem[];
}

// Strip the leading \n that remark-rehype injects into code block text nodes
function rehypeTrimCodeNewlines() {
  return (tree: Root) => {
    const walk = (node: Root | Element) => {
      if ('children' in node) {
        if ((node as Element).tagName === 'pre') {
          const code = (node as Element).children.find(
            (c): c is Element => (c as Element).tagName === 'code'
          );
          if (code?.children[0]?.type === 'text') {
            code.children[0].value = code.children[0].value.replace(/^\n/, '');
            const last = code.children[code.children.length - 1];
            if (last?.type === 'text') last.value = last.value.replace(/\n$/, '');
          }
        }
        (node as Element).children?.forEach(c => {
          if (c.type === 'element') walk(c as Element);
        });
      }
    };
    walk(tree);
  };
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node)
    return extractText((node as ReactElement<{ children?: ReactNode }>).props.children);
  return '';
}

// Strip the /api suffix from VITE_API_URL to get the backend origin
// e.g. "https://api.tom-sabala.dev/api" → "https://api.tom-sabala.dev"
const API_ORIGIN = (import.meta.env.VITE_API_URL as string ?? '').replace(/\/api$/, '');

const mdComponents: Components = {
  img({ src, alt, ...props }) {
    // Rewrite root-relative /api/ paths to the backend origin
    const resolvedSrc = src?.startsWith('/api/') ? `${API_ORIGIN}${src}` : src;
    return <img src={resolvedSrc} alt={alt} style={{ maxWidth: '100%', height: 'auto' }} {...props} />;
  },
  pre({ children }) {
    const codeEl = children as ReactElement<{ className?: string; children?: ReactNode }>;
    const codeClass = codeEl?.props?.className ?? '';
    const match = /language-(\w+)/.exec(codeClass);
    const lang = match?.[1] ?? 'code';

    const rawText = extractText(codeEl?.props?.children);
    const lines = rawText.split('\n');
    const lineCount = lines.at(-1) === '' ? lines.length - 1 : lines.length;

    return (
      <div style={{ overflow: 'hidden', border: '1px solid var(--ln2)', margin: '1.5rem 0' }}>
        <div style={{ background: '#2d2d2d', padding: '7px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#858585', background: '#3a3a3a', padding: '2px 8px', fontFamily: "'DM Mono', monospace" }}>
            {lang}
          </span>
        </div>
        <div style={{ display: 'flex', background: '#1e1e1e', overflowX: 'auto' }}>
          <div style={{ background: '#2d2d2d', padding: '16px 10px 16px 8px', color: '#858585', fontSize: '13px', lineHeight: '1.6', textAlign: 'right', userSelect: 'none', borderRight: '1px solid #1a1a1a', flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>
            {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
          </div>
          <pre style={{ flex: 1, margin: 0, padding: '16px', background: 'none', fontSize: '13px', lineHeight: '1.6', color: '#d4d4d4', whiteSpace: 'pre', fontFamily: "'DM Mono', monospace" }}>
            {children}
          </pre>
        </div>
      </div>
    );
  },
};

function TocList({ items, activeId }: { items: TocItem[]; activeId: string }) {
  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-2">
      {items.map(item => (
        <li key={item.id} className="flex flex-col gap-2">
          <a
            href={`#${item.id}`}
            className={`no-underline font-mono text-[12px] leading-[1.4] ${
              activeId === item.id ? 'text-acct' : 'text-mut hover:text-ink'
            }`}
          >
            {item.label}
          </a>
          {item.children && item.children.length > 0 && (
            <div className="pl-3 border-l border-ln">
              <TocList items={item.children} activeId={activeId} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

interface DeepDiveProps {
  content: string;
  toc: TocItem[];
}

export default function DeepDive({ content, toc }: DeepDiveProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState('');

  // Track active heading with IntersectionObserver
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !content) return;

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
  }, [content]);

  const markdown = (
    <div
      ref={contentRef}
      className="prose max-w-none prose-headings:font-semibold prose-headings:text-ink prose-p:text-ink2 prose-li:text-ink2 prose-strong:text-ink prose-a:text-acct prose-code:text-ink prose-code:bg-s1 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-hr:border-ln prose-blockquote:border-l-acc prose-blockquote:text-ink2 prose-th:text-ink prose-td:text-ink2"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSlug, rehypeTrimCodeNewlines, rehypeHighlight]}
        components={mdComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-8 items-start">
      <div className="min-w-0 order-2 xl:order-1">{markdown}</div>

      {toc.length > 0 && (
        <>
          <details className="xl:hidden order-1 border border-ln bg-s1 p-4">
            <summary className="font-mono text-[11px] leading-none tracking-[0.12em] uppercase text-acct cursor-pointer">
              Contents
            </summary>
            <div className="mt-4">
              <TocList items={toc} activeId={activeId} />
            </div>
          </details>

          <nav className="hidden xl:block order-2 sticky top-[88px] border-l border-ln pl-5">
            <span className="font-mono text-[10px] leading-none tracking-[0.12em] uppercase text-mut block mb-4">
              Contents
            </span>
            <TocList items={toc} activeId={activeId} />
          </nav>
        </>
      )}
    </div>
  );
}
