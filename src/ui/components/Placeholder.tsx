import type { ReactNode } from 'react';

/** Khối "sắp có" cho các phần chưa làm, ghi rõ phiên nào sẽ làm. */
export function Placeholder({ session, children }: { session: string; children: ReactNode }) {
  return (
    <div className="placeholder">
      <span className="tag">{session}</span>
      <p>{children}</p>
    </div>
  );
}
