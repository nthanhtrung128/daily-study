import { useEffect, useState } from 'react';
import { parseHash, type RouteId } from './routes';

export function useHashRoute(): RouteId {
  const [route, setRoute] = useState<RouteId>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
