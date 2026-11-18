import { useEffect, useState } from 'react';
import { parseHash, type RouteId } from './routes';

export function useHashRoute(): RouteId {
  return parseHash(useLocationHash());
}

export function useLocationHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return hash;
}
