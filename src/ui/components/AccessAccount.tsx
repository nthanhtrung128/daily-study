import { useEffect, useRef, useState } from 'react';

type Session =
  | { kind: 'idle' | 'checking' | 'login' | 'unavailable' }
  | { kind: 'verified'; email: string };

const messages = {
  idle: 'Cloudflare Access quản lý đăng nhập vào Daily Study.',
  checking: 'Đang kiểm tra phiên với Cloudflare…',
  login: 'Cần đăng nhập qua Cloudflare để xác nhận phiên.',
  unavailable: 'Chưa kiểm tra được phiên. Bạn có thể thử lại khi có kết nối.',
};

export function AccessAccount() {
  const [online, setOnline] = useState(navigator.onLine);
  const [session, setSession] = useState<Session>({ kind: 'idle' });
  const request = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (location.hash === '#cai-dat?muc=tai-khoan') heading.current?.focus();
    const reset = () => {
      request.current?.abort();
      setSession({ kind: 'idle' });
      setOnline(navigator.onLine);
    };
    window.addEventListener('online', reset);
    window.addEventListener('offline', reset);
    window.addEventListener('pageshow', reset);
    return () => {
      request.current?.abort();
      window.removeEventListener('online', reset);
      window.removeEventListener('offline', reset);
      window.removeEventListener('pageshow', reset);
    };
  }, []);

  async function check() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSession({ kind: 'checking' });
    const timeout = window.setTimeout(() => {
      controller.abort();
      setSession({ kind: 'unavailable' });
    }, 10000);
    try {
      const response = await fetch('/cdn-cgi/access/get-identity', {
        credentials: 'same-origin', cache: 'no-store', redirect: 'manual', signal: controller.signal,
      });
      let result: Session = { kind: 'unavailable' };
      if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) {
        result = { kind: 'login' };
      } else if (response.headers.get('content-type')?.includes('application/json')) {
        const identity = await response.json();
        if (response.status === 400 && identity?.err === 'no app token set') {
          result = { kind: 'login' };
        } else if (response.ok && typeof identity?.email === 'string' && identity.email.trim()) {
          result = { kind: 'verified', email: identity.email.trim() };
        }
      }
      if (!controller.signal.aborted) setSession(result);
    } catch {
      if (!controller.signal.aborted) setSession({ kind: 'unavailable' });
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  }

  return (
    <section className="panel stack" aria-labelledby="access-heading">
      <h2 className="h-page" id="access-heading" tabIndex={-1} ref={heading}>Tài khoản</h2>
      <p className="access-status" role="status">
        {!online ? 'Bạn đang ngoại tuyến. Có thể tiếp tục học trên máy này.'
          : session.kind === 'verified' ? <>Phiên vừa xác nhận cho <strong>{session.email}</strong>.</>
          : messages[session.kind]}
      </p>
      <div className="row">
        {online && (session.kind === 'verified'
          ? <a className="btn ghost link-btn" href="/cdn-cgi/access/logout">Đăng xuất Cloudflare</a>
          : <a className="btn link-btn" href="/dang-nhap?ve=tai-khoan">Đăng nhập qua Cloudflare</a>)}
        <button className="btn ghost" type="button" disabled={!online || session.kind === 'checking'} onClick={() => void check()}>
          Kiểm tra phiên
        </button>
      </div>
      <p className="hint">Memo, tiến độ và ghi âm được lưu trên thiết bị này, kể cả sau khi đăng xuất.</p>
    </section>
  );
}
