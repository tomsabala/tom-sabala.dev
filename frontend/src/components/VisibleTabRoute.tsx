import { useIsTabVisible } from '../contexts/TabConfigContext.tsx';

interface VisibleTabRouteProps {
  tabKey: string;
  children: React.ReactNode;
}

/**
 * Route guard for tab-visibility-controlled pages.
 *
 * - Admin: always renders children
 * - Loading: renders children (optimistic — avoids flash of 404)
 * - Loaded + tab hidden: renders a 404-style message
 *
 * Backend enforces the same rule, so even a direct API call returns 404.
 */
function VisibleTabRoute({ tabKey, children }: VisibleTabRouteProps) {
  const isVisible = useIsTabVisible(tabKey);

  if (!isVisible) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-center px-4">
        <p className="text-6xl font-bold text-gray-200 dark:text-gray-700 mb-4">404</p>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Page not found</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">This page is not available.</p>
      </div>
    );
  }

  return <>{children}</>;
}

export default VisibleTabRoute;
