/** Điều hướng bằng hash (#hom-nay, #tra-cuu, …) để chạy được cả khi mở offline từ Màn hình chính. */
export const ROUTES = [
  { id: 'hom-nay', label: 'Hôm nay' },
  { id: 'tra-cuu', label: 'Tra cứu' },
  { id: 'lo-trinh', label: 'Lộ trình' },
  { id: 'doc-them', label: 'Đọc thêm' },
  { id: 'tien-do', label: 'Tiến độ' },
  { id: 'cai-dat', label: 'Cài đặt' },
] as const;

export type RouteId = (typeof ROUTES)[number]['id'];

export const DEFAULT_ROUTE: RouteId = 'hom-nay';

const ROUTE_IDS: ReadonlySet<string> = new Set(ROUTES.map((r) => r.id));

export function isRouteId(value: string): value is RouteId {
  return ROUTE_IDS.has(value);
}

/** Đọc route từ chuỗi hash ("#tra-cuu", "#/tra-cuu", "#tra-cuu?q=x"); không hợp lệ → trang mặc định. */
export function parseHash(hash: string): RouteId {
  const id = decodeURIComponent(hash.replace(/^#\/?/, '').split(/[?/]/)[0] ?? '')
    .trim()
    .toLowerCase();
  return isRouteId(id) ? id : DEFAULT_ROUTE;
}

export function routeLabel(id: RouteId): string {
  return ROUTES.find((r) => r.id === id)?.label ?? '';
}

export function lessonHref(id: string): string {
  return `#lo-trinh?bai=${encodeURIComponent(id)}`;
}

export function reviewHref(code: string): string {
  return '#lo-trinh?on=' + encodeURIComponent(code);
}
