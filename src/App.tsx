import type { ReactElement } from 'react';
import { ROUTES, type RouteId } from './ui/routes';
import { useHashRoute } from './ui/useHashRoute';
import { TodayPage } from './ui/pages/TodayPage';
import { LookupPage } from './ui/pages/LookupPage';
import { ProgressPage } from './ui/pages/ProgressPage';
import { SettingsPage } from './ui/pages/SettingsPage';
import { useProgress } from './ui/useProgress';

const PAGES: Record<RouteId, () => ReactElement> = {
  'hom-nay': TodayPage,
  'tra-cuu': LookupPage,
  'tien-do': ProgressPage,
  'cai-dat': SettingsPage,
};

export function App() {
  const route = useHashRoute();
  const Page = PAGES[route];
  const streak = useProgress().streak();

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="top-in">
            <div className="brand">
              <b>Ôn luyện mỗi ngày</b>
              <span>Total Rewards 101 · Tiếng Anh công sở</span>
            </div>
            <div className="streak" aria-label="Chuỗi ngày ôn">
              Chuỗi <b data-testid="streak">{streak}</b> ngày
            </div>
          </div>
          <nav className="tabs" aria-label="Mục">
            {ROUTES.map((r) => (
              <a key={r.id} href={`#${r.id}`} aria-current={r.id === route ? 'page' : undefined}>
                {r.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="wrap" id="app">
        <Page key={route} />
      </main>
    </>
  );
}
