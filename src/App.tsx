import { useEffect, type ReactElement } from 'react';
import { ROUTES, type RouteId } from './ui/routes';
import { useHashRoute } from './ui/useHashRoute';
import { TodayPage } from './ui/pages/TodayPage';
import { LookupPage } from './ui/pages/LookupPage';
import { ProgressPage } from './ui/pages/ProgressPage';
import { SettingsPage } from './ui/pages/SettingsPage';
import { useProgress } from './ui/useProgress';
import { StorageAlert } from './ui/components/StorageAlert';
import { tts } from './modules/english/tts';
import { speechRec } from './modules/english/speech/recognizer';

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

  // Ẩn app / rời trang: dừng đọc và nhận giọng ở mọi màn (kể cả nút Nghe thử ở Cài đặt, màn kết quả).
  useEffect(() => {
    const offTts = tts.bindPageLifecycle();
    const offRec = speechRec.bindPageLifecycle();
    return () => {
      offTts();
      offRec();
    };
  }, []);
  // Đổi tab: màn cũ unmount; dừng luôn câu đang đọc / lượt nghe còn dở.
  useEffect(
    () => () => {
      tts.cancel();
      speechRec.abort();
    },
    [route],
  );

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
        <StorageAlert />
        <Page key={route} />
      </main>
    </>
  );
}
