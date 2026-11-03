/** Bộ sinh số ngẫu nhiên có thể gieo hạt (để test tái lập được). Mặc định dùng Math.random. */
export type Rng = () => number;

export const defaultRng: Rng = () => Math.random();

/** mulberry32 — nhỏ, đủ tốt cho sinh đề. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Số nguyên ngẫu nhiên trong [a, b]. */
export const rnd = (rng: Rng, a: number, b: number): number => a + Math.floor(rng() * (b - a + 1));

export function pick<T>(rng: Rng, a: readonly T[]): T {
  const v = a[Math.floor(rng() * a.length)];
  if (v === undefined) throw new Error('pick: mảng rỗng');
  return v;
}

export function shuffle<T>(rng: Rng, a: readonly T[]): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
