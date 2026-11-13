import { useEffect, useState, useCallback } from 'react';

export interface Route {
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
}

function parseLocation(): Route {
  const fullPath = window.location.pathname || '/';
  const [pathPart, queryPart] = fullPath.split('?');
  return {
    path: pathPart || '/',
    params: {},
    query: new URLSearchParams(queryPart || window.location.search.replace(/^\?/, '') || ''),
  };
}

let navSeq = 0;

export function useRouter() {
  const [route, setRoute] = useState<Route>(parseLocation);

  useEffect(() => {
    const handler = () => {
      navSeq++;
      setRoute(parseLocation());
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const navigate = useCallback((path: string) => {
    if (path.includes('?')) {
      const [pathname, search] = path.split('?');
      window.history.pushState({}, '', `${pathname}?${search}`);
    } else {
      window.history.pushState({}, '', path);
    }
    navSeq++;
    setRoute(parseLocation());
    window.scrollTo(0, 0);
  }, []);

  return { route, navigate };
}

export function navigate(path: string) {
  if (path.includes('?')) {
    const [pathname, search] = path.split('?');
    window.history.pushState({}, '', `${pathname}?${search}`);
  } else {
    window.history.pushState({}, '', path);
  }
  navSeq++;
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function getNavSeq(): number {
  return navSeq;
}

export function matchRoute(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}
