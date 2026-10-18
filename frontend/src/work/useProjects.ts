/**
 * The visible project list, fetched once per mount.
 *
 * Both the landing page and `/work/:slug` need the whole list — the landing renders every
 * row, the detail page needs the siblings for its tab strip and prev/next — so they share
 * one fetch shape here rather than two copies of the same effect. Admins get hidden
 * projects too, which is why the fetch waits for auth to resolve.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { getPortfolio } from '../repositories/portfolioRepository.ts';
import type { PortfolioItem } from '../types/index.ts';

export interface ProjectList {
  projects: PortfolioItem[];
  loading: boolean;
  /** Empty unless the request failed; the caller decides how loudly to say so. */
  error: string;
}

export function useProjects(): ProjectList {
  const { isAuthenticated, isLoading } = useAuth();
  const [projects, setProjects] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    getPortfolio(isAuthenticated)
      .then(resp => {
        if (!cancelled) setProjects(Array.isArray(resp?.data) ? resp.data : []);
      })
      .catch(() => {
        if (!cancelled) setError('Projects are unavailable right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated, isLoading]);

  return { projects, loading, error };
}
