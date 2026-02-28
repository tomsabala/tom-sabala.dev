import { useEffect, useRef, useState } from 'react';
import type { ReactNode, ReactElement } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { Root, Element } from 'hast';
import * as portfolioRepository from '../repositories/portfolioRepository.ts';
import type { PortfolioItem } from '../types/index.ts';
import { useToc } from '../contexts/TocContext.tsx';

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
      <div style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.5)', margin: '1.5rem 0' }}>
        <div style={{ background: '#2d2d2d', padding: '7px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#858585', background: '#3a3a3a', padding: '2px 8px', borderRadius: '12px', fontFamily: 'Menlo, Consolas, Monaco, monospace' }}>
            {lang}
          </span>
        </div>
        <div style={{ display: 'flex', background: '#1e1e1e', overflowX: 'auto' }}>
          <div style={{ background: '#2d2d2d', padding: '16px 10px 16px 8px', color: '#858585', fontSize: '13px', lineHeight: '1.6', textAlign: 'right', userSelect: 'none', borderRight: '1px solid #1a1a1a', flexShrink: 0, fontFamily: "'Menlo', 'Consolas', 'Monaco', monospace" }}>
            {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
          </div>
          <pre style={{ flex: 1, margin: 0, padding: '16px', background: 'none', fontSize: '13px', lineHeight: '1.6', color: '#d4d4d4', whiteSpace: 'pre', fontFamily: "'Menlo', 'Consolas', 'Monaco', monospace" }}>
            {children}
          </pre>
        </div>
      </div>
    );
  },
};

function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<PortfolioItem | null>(null);
  const [deepDive, setDeepDive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { setToc, setActiveId, setTocTitle } = useToc();

  // Clear TOC on unmount
  useEffect(() => {
    return () => {
      setToc([]);
      setActiveId('');
      setTocTitle('');
    };
  }, [setToc, setActiveId, setTocTitle]);

  // Track active heading with IntersectionObserver
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !deepDive) return;

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
  }, [deepDive, setActiveId]);

  useEffect(() => {
    if (!id) return;
    portfolioRepository.getProject(Number(id))
      .then(res => {
        if (res.success) {
          setProject(res.data);
          if (res.data.docsSlug) {
            setTocTitle(res.data.title);
            return portfolioRepository.getProjectDeepDive(Number(id))
              .then(ddRes => {
                if (ddRes.success) {
                  setDeepDive(ddRes.content);
                  setToc(ddRes.toc ?? []);
                }
              })
              .catch(() => {});
          }
        } else {
          setError('Project not found.');
        }
      })
      .catch(() => setError('Failed to load project.'))
      .finally(() => setLoading(false));
  }, [id]);

  const backLink = (
    <Link
      to="/portfolio"
      className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to Portfolio
    </Link>
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        {backLink}
        <div className="bg-white dark:bg-[#252525] rounded-lg shadow-md border border-transparent dark:border-gray-700 p-4 sm:p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            <div className="h-56 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        {backLink}
        <div className="bg-white dark:bg-[#252525] rounded-lg shadow-md border border-transparent dark:border-gray-700 p-4 sm:p-8">
          <p className="text-red-500">{error || 'Project not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
      {backLink}

      <div className="bg-white dark:bg-[#252525] rounded-lg shadow-md border border-transparent dark:border-gray-700 overflow-hidden">
        {project.image_url && (
          <div className="w-full bg-gray-100 dark:bg-gray-800">
            <img
              src={project.image_url}
              alt={project.title}
              className="w-full object-cover max-h-72"
            />
          </div>
        )}

        <div className="p-4 sm:p-8">
          {!deepDive && (
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              {project.title}
            </h1>
          )}

          {!deepDive && (
            <div className="flex flex-wrap gap-2 mb-4">
              {project.technologies.map((tech, i) => (
                <span
                  key={i}
                  className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-medium px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-4 mb-8">
            {project.github_url && (
              <a
                href={project.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[hsl(210,65%,60%)] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub
              </a>
            )}
            {project.live_url && (
              <a
                href={project.live_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[hsl(210,65%,60%)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Live Demo
              </a>
            )}
          </div>

          <hr className="border-gray-200 dark:border-gray-700 mb-8" />

          {(deepDive ?? project.content) ? (
            <div
              ref={contentRef}
              className="prose prose-gray dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-[hsl(210,65%,60%)] prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:text-gray-800 dark:prose-code:text-gray-200"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSlug, rehypeTrimCodeNewlines, rehypeHighlight]}
                components={mdComponents}
              >
                {deepDive ?? project.content!}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              {project.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectDetail;
