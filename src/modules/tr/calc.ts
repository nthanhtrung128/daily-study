import { fmt } from '../../core/num';
import { pick, rnd, shuffle, type Rng } from '../../core/rng';

/**
 * 19 bài tính sinh số ngẫu nhiên — chuyển nguyên công thức từ bản cũ.
 * Mỗi đề trả về đáp số (ans), dung sai (tol), đơn vị, lời giải; `v` là số liệu đã sinh để test tính lại độc lập.
 * Số liệu pháp lý 2026 [Bổ sung]: giảm trừ bản thân 15,5tr, NPT 6,2tr, biểu 5 bậc 5/10/20/30/35% (10/30/60/100tr),
 * BH NLĐ 10,5%, DN 21,5% (chưa gồm KPCĐ). Không tự đổi khi người dùng chưa xác nhận.
 */
export interface CalcProblem {
  q: string;
  ans: number;
  unit: string;
  dec: number;
  tol: number;
  sol: string;
  v: Record<string, number | number[]>;
}

export interface CalcDef {
  id: string;
  bai: string;
  name: string;
  sup?: boolean;
  gen: (rng: Rng) => CalcProblem;
}

export const PIT_2026 = {
  personal: 15.5e6,
  dependant: 6.2e6,
  employeeIns: 0.105,
  employerIns: 0.215,
  brackets: [
    [10e6, 0.05],
    [30e6, 0.1],
    [60e6, 0.2],
    [100e6, 0.3],
    [Infinity, 0.35],
  ] as ReadonlyArray<readonly [number, number]>,
} as const;

/** Thuế lũy tiến từng phần trên thu nhập tính thuế. */
export function progressiveTax(ti: number): number {
  let tax = 0;
  let prev = 0;
  for (const [cap, r] of PIT_2026.brackets) {
    if (ti > prev) tax += (Math.min(ti, cap) - prev) * r;
    prev = cap;
  }
  return tax;
}

const tr = (n: number) => fmt(n / 1e6, 2);

export function compaRatio(salary: number, midpoint: number): number {
  return salary / midpoint;
}

export function rangePenetration(salary: number, min: number, max: number): number {
  return ((salary - min) / (max - min)) * 100;
}

export const CALC: readonly CalcDef[] = [
  {
    id: 'C-mid', bai: '2', name: 'Midpoint',
    gen(r) {
      const min = rnd(r, 50, 250) * 1e5, s = pick(r, [0.3, 0.35, 0.4, 0.5]), max = Math.round((min * (1 + s)) / 1e3) * 1e3;
      const a = (min + max) / 2;
      return { q: `Grade có Min ${fmt(min)} đ, Max ${fmt(max)} đ. Midpoint bằng bao nhiêu?`, ans: a / 1e6, unit: 'triệu đồng', dec: 2, tol: 0.01, sol: `Mid = (Min + Max)/2 = (${fmt(min)} + ${fmt(max)})/2 = ${fmt(a)} đ ≈ ${tr(a)} triệu.`, v: { min, max } };
    },
  },
  {
    id: 'C-spread', bai: '2', name: 'Range spread',
    gen(r) {
      const min = rnd(r, 60, 300) * 1e5, max = Math.round((min * (1 + rnd(r, 25, 60) / 100)) / 1e4) * 1e4;
      const a = ((max - min) / min) * 100;
      return { q: `Min ${fmt(min)} đ, Max ${fmt(max)} đ. Range spread là bao nhiêu %?`, ans: a, unit: '%', dec: 1, tol: 0.15, sol: `Spread = (Max − Min)/Min = (${fmt(max)} − ${fmt(min)})/${fmt(min)} = ${fmt(a, 1)}%. Nhớ chia cho Min.`, v: { min, max } };
    },
  },
  {
    id: 'C-minmid', bai: '3', name: 'Min từ Mid',
    gen(r) {
      const mid = rnd(r, 80, 600) * 1e5, s = pick(r, [0.2, 0.3, 0.35, 0.4, 0.5]);
      const a = mid / (1 + s / 2), mx = a * (1 + s);
      return { q: `Midpoint ${fmt(mid)} đ, range spread ${fmt(s * 100)}%. Min của dải là bao nhiêu?`, ans: a / 1e6, unit: 'triệu đồng', dec: 2, tol: 0.01, sol: `Min = Mid/(1 + spread/2) = ${fmt(mid)}/${fmt(1 + s / 2, 3)} = ${fmt(a)} đ ≈ ${tr(a)} triệu. Max = Min × (1 + spread) = ${tr(mx)} triệu.`, v: { mid, s } };
    },
  },
  {
    id: 'C-overlap', bai: '2', name: 'Overlap',
    gen(r) {
      const m1 = rnd(r, 80, 150) * 1e5;
      const x1 = Math.round((m1 * (1 + rnd(r, 30, 50) / 100)) / 1e5) * 1e5;
      const m2 = Math.round((m1 * (1 + rnd(r, 10, 25) / 100)) / 1e5) * 1e5;
      const x2 = Math.round((m2 * (1 + rnd(r, 30, 50) / 100)) / 1e5) * 1e5;
      const a = ((x1 - m2) / (x2 - m2)) * 100;
      return { q: `Grade dưới: ${fmt(m1)} – ${fmt(x1)} đ. Grade trên: ${fmt(m2)} – ${fmt(x2)} đ. Overlap là bao nhiêu %?`, ans: a, unit: '%', dec: 1, tol: 0.15, sol: `Overlap = (Max dưới − Min trên)/(Max trên − Min trên) = (${fmt(x1)} − ${fmt(m2)})/(${fmt(x2)} − ${fmt(m2)}) = ${fmt(a, 1)}%.`, v: { m1, x1, m2, x2 } };
    },
  },
  {
    id: 'C-mdiff', bai: '2', name: 'Midpoint differential',
    gen(r) {
      const m1 = rnd(r, 100, 400) * 1e5, d = rnd(r, 5, 30) / 100, m2 = Math.round((m1 * (1 + d)) / 1e3) * 1e3;
      const a = ((m2 - m1) / m1) * 100;
      return { q: `Mid grade dưới ${fmt(m1)} đ, mid grade trên ${fmt(m2)} đ. Midpoint differential là bao nhiêu %?`, ans: a, unit: '%', dec: 1, tol: 0.15, sol: `MD = (Mid trên − Mid dưới)/Mid dưới = (${fmt(m2)} − ${fmt(m1)})/${fmt(m1)} = ${fmt(a, 1)}%.`, v: { m1, m2 } };
    },
  },
  {
    id: 'C-cr', bai: '3', name: 'Compa-ratio',
    gen(r) {
      const mid = rnd(r, 100, 400) * 1e5, sal = Math.round((mid * rnd(r, 80, 120)) / 100 / 1e5) * 1e5;
      const a = compaRatio(sal, mid);
      return { q: `Midpoint ${fmt(mid)} đ, lương nhân viên ${fmt(sal)} đ. Compa-ratio là bao nhiêu?`, ans: a, unit: '(VD 0,95)', dec: 2, tol: 0.006, sol: `CR = Lương/Mid = ${fmt(sal)}/${fmt(mid)} = ${fmt(a, 2)} (${a >= 1 ? 'trên' : 'dưới'} midpoint).`, v: { mid, sal } };
    },
  },
  {
    id: 'C-pen', bai: '3', name: 'Range penetration',
    gen(r) {
      const min = rnd(r, 70, 200) * 1e5, max = Math.round((min * 1.5) / 1e5) * 1e5;
      const sal = Math.round((min + ((max - min) * rnd(r, 5, 95)) / 100) / 1e5) * 1e5;
      const a = rangePenetration(sal, min, max);
      return { q: `Dải ${fmt(min)} – ${fmt(max)} đ, lương ${fmt(sal)} đ. Range penetration là bao nhiêu %?`, ans: a, unit: '%', dec: 1, tol: 0.15, sol: `RP = (Lương − Min)/(Max − Min) = (${fmt(sal)} − ${fmt(min)})/(${fmt(max)} − ${fmt(min)}) = ${fmt(a, 1)}%.`, v: { min, max, sal } };
    },
  },
  {
    id: 'C-mi', bai: '3', name: 'Market index',
    gen(r) {
      const mk = rnd(r, 150, 500) * 1e5, sal = Math.round((mk * rnd(r, 70, 120)) / 100 / 1e5) * 1e5;
      const a = (sal / mk) * 100;
      return { q: `Lương ${fmt(sal)} đ, mức thị trường (P50) ${fmt(mk)} đ. Market index là bao nhiêu %?`, ans: a, unit: '%', dec: 1, tol: 0.15, sol: `MI = Lương/Thị trường = ${fmt(sal)}/${fmt(mk)} = ${fmt(a, 1)}% — chỉ số bên ngoài (khác compa-ratio so với midpoint).`, v: { mk, sal } };
    },
  },
  {
    id: 'C-pct', bai: '3', name: 'Percentile',
    gen(r) {
      const n = pick(r, [11, 15]);
      const vals = shuffle(r, Array.from({ length: 40 }, (_, i) => (15 + i) * 5e5)).slice(0, n).sort((a, b) => a - b);
      const p = pick(r, [25, 75, 90]);
      const pos = (p / 100) * (n - 1) + 1, lo = Math.floor(pos), fr = pos - lo;
      const at = (i: number) => vals[i] ?? 0;
      const a = fr ? at(lo - 1) + (at(lo) - at(lo - 1)) * fr : at(lo - 1);
      const m = (x: number) => fmt(x / 1e6, 1);
      return {
        q: `Khảo sát ${n} mức lương (triệu đồng, đã sắp xếp): ${vals.map(m).join(' · ')}. Tính P${p}.`,
        ans: a / 1e6, unit: 'triệu đồng', dec: 2, tol: 0.01,
        sol: `Vị trí = ${p}/100 × (${n} − 1) + 1 = ${fmt(pos, 2)}. ${fr ? `Giá trị thứ ${lo} = ${m(at(lo - 1))}, thứ ${lo + 1} = ${m(at(lo))} → ${m(at(lo - 1))} + (${m(at(lo))} − ${m(at(lo - 1))}) × ${fmt(fr, 2)} = ${fmt(a / 1e6, 2)}` : `Đúng giá trị thứ ${lo} = ${fmt(a / 1e6, 2)}`} triệu.`,
        v: { vals, p },
      };
    },
  },
  {
    id: 'C-bonus', bai: '4', name: 'Thưởng hiệu suất',
    gen(r) {
      const sal = rnd(r, 12, 40) * 1e6, tm = pick(r, [1, 1.5, 2]);
      const w = pick(r, [[0.2, 0, 0.8], [0.1, 0.3, 0.6], [0.3, 0.4, 0.3], [0.1, 0.2, 0.7]] as const);
      const k = [pick(r, [0.9, 1, 1.1, 1.2]), pick(r, [0.8, 0.9, 1, 1.1]), pick(r, [0.8, 1, 1.2, 1.3, 1.5])] as const;
      const f = w[0] * k[0] + w[1] * k[1] + w[2] * k[2];
      const a = f * sal * tm;
      const parts = ([['công ty', 0], ['bộ phận', 1], ['cá nhân', 2]] as const).filter(([, i]) => w[i] > 0);
      return {
        q: `Lương ${fmt(sal / 1e6)} triệu/tháng, thưởng mục tiêu ${fmt(tm, 1)} tháng lương. Trọng số – kết quả: ${parts.map(([n, i]) => `${n} ${fmt(w[i] * 100)}% (KQ ${fmt(k[i], 1)})`).join('; ')}. Tiền thưởng là bao nhiêu?`,
        ans: a / 1e6, unit: 'triệu đồng', dec: 2, tol: 0.01,
        sol: `Thưởng = (${parts.map(([, i]) => `${fmt(k[i], 1)}×${fmt(w[i] * 100)}%`).join(' + ')}) × ${fmt(sal / 1e6)} × ${fmt(tm, 1)} = ${fmt(f, 3)} × ${fmt((sal * tm) / 1e6, 1)} = ${tr(a)} triệu.`,
        v: { sal, tm, w: [...w], k: [...k] },
      };
    },
  },
  {
    id: 'C-sales', bai: '4', name: 'Thưởng theo target incentive',
    gen(r) {
      const quota = rnd(r, 10, 40) * 1e8, ti = rnd(r, 4, 15) * 1e7, att = rnd(r, 101, 140), acc = pick(r, [1.5, 2, 3]);
      const a = ti + ((att - 100) / 100) * ti * acc;
      return { q: `Quota ${fmt(quota / 1e9, 1)} tỷ, target incentive ${fmt(ti / 1e6)} triệu khi đạt 100%. Nhân viên đạt ${att}% quota; phần vượt áp accelerator ${fmt(acc, 1)}×. Thưởng là bao nhiêu?`, ans: a / 1e6, unit: 'triệu đồng', dec: 1, tol: 0.06, sol: `Thưởng = Target + %vượt × Target × accelerator = ${fmt(ti / 1e6)} + ${att - 100}% × ${fmt(ti / 1e6)} × ${fmt(acc, 1)} = ${fmt(a / 1e6, 1)} triệu.`, v: { quota, ti, att, acc } };
    },
  },
  {
    id: 'C-icr', bai: '4', name: 'ICR',
    gen(r) {
      const quota = rnd(r, 10, 50) * 1e8, ti = rnd(r, 5, 20) * 1e7;
      const a = (ti / quota) * 100;
      return { q: `Quota năm ${fmt(quota / 1e9, 1)} tỷ, target incentive ${fmt(ti / 1e6)} triệu. Tỷ lệ hoa hồng cá nhân (ICR) là bao nhiêu %?`, ans: a, unit: '%', dec: 2, tol: 0.01, sol: `ICR = Target incentive/Quota = ${fmt(ti / 1e6)} triệu / ${fmt(quota / 1e6)} triệu = ${fmt(a, 2)}%.`, v: { quota, ti } };
    },
  },
  {
    id: 'C-cell', bai: '6', name: 'Đóng góp ô merit',
    gen(r) {
      const P = pick(r, [0.15, 0.2, 0.3, 0.35, 0.4, 0.45]), C = pick(r, [0.16, 0.2, 0.24, 0.25, 0.3, 0.35]), G = pick(r, [3, 4, 4.5, 5, 5.5, 6, 7.5, 8.5]);
      const a = P * C * G;
      return { q: `Tỷ lệ NV ở xếp loại này ${fmt(P * 100)}%, tỷ lệ NV ở quartile này ${fmt(C * 100)}%, mức tăng của ô ${fmt(G, 1)}%. Ô này đóng góp bao nhiêu điểm % vào tổng ngân sách merit?`, ans: a, unit: 'điểm %', dec: 3, tol: 0.002, sol: `P × C × G = ${fmt(P, 2)} × ${fmt(C, 2)} × ${fmt(G, 1)} = ${fmt(a, 3)}.`, v: { P, C, G } };
    },
  },
  {
    id: 'C-mean', bai: '6', name: 'Điểm trung bình kỳ vọng',
    gen(rg) {
      const r = [rnd(rg, 5, 20), rnd(rg, 25, 45), rnd(rg, 25, 45), rnd(rg, 0, 10)] as [number, number, number, number];
      let t = r.reduce((x, y) => x + y, 0);
      if (t > 100) {
        r[1] -= t - 100;
        t = 100;
      }
      const dist = [r[0], r[1], r[2], r[3], 100 - t] as const;
      const a = (5 * dist[0] + 4 * dist[1] + 3 * dist[2] + 2 * dist[3] + 1 * dist[4]) / 100;
      const p = (x: number) => fmt(x / 100, 2);
      return { q: `Phân bố xếp loại dự kiến: 5 = ${dist[0]}%, 4 = ${dist[1]}%, 3 = ${dist[2]}%, 2 = ${dist[3]}%, 1 = ${dist[4]}%. Điểm trung bình kỳ vọng là bao nhiêu?`, ans: a, unit: 'điểm', dec: 2, tol: 0.006, sol: `Σ(xếp loại × tỷ lệ) = 5×${p(dist[0])} + 4×${p(dist[1])} + 3×${p(dist[2])} + 2×${p(dist[3])} + 1×${p(dist[4])} = ${fmt(a, 2)}.`, v: { dist: [...dist] } };
    },
  },
  {
    id: 'C-meritmid', bai: '6', name: 'Merit theo % midpoint',
    gen(r) {
      const mid = rnd(r, 100, 300) * 1e5, p = pick(r, [3, 4, 5, 6]), sal = Math.round((mid * rnd(r, 80, 120)) / 100 / 1e5) * 1e5;
      const inc = (mid * p) / 100, a = (inc / sal) * 100;
      return { q: `Chính sách tăng ${p}% của midpoint cho mức "Đạt". Midpoint ${fmt(mid)} đ, lương nhân viên ${fmt(sal)} đ. Mức tăng tính theo % lương hiện tại là bao nhiêu?`, ans: a, unit: '%', dec: 2, tol: 0.02, sol: `Tăng = ${p}% × ${fmt(mid)} = ${fmt(inc)} đ → ${fmt(inc)}/${fmt(sal)} = ${fmt(a, 2)}% lương. Người dưới mid tăng nhanh hơn về %.`, v: { mid, p, sal } };
    },
  },
  {
    id: 'C-aging', bai: '6', name: 'Data aging',
    gen(r) {
      const base = rnd(r, 100, 400) * 1e5, g = pick(r, [5, 6, 7, 8, 9, 10]), m = rnd(r, 3, 12);
      const a = base * Math.pow(1 + g / 100 / 12, m);
      return { q: `Dữ liệu khảo sát: ${fmt(base)} đ, thu thập cách đây ${m} tháng. Thị trường tăng ${g}%/năm. Giá trị cập nhật hiện tại là bao nhiêu?`, ans: a / 1e6, unit: 'triệu đồng', dec: 2, tol: 0.01, sol: `= ${fmt(base / 1e6, 1)} × (1 + ${g}%/12)^${m} = ${fmt(base / 1e6, 1)} × ${fmt(Math.pow(1 + g / 1200, m), 4)} = ${tr(a)} triệu.`, v: { base, g, m } };
    },
  },
  {
    id: 'C-comp', bai: '8-9', name: 'COMP2 / COMP3',
    gen(r) {
      const b = rnd(r, 12, 50) * 1e6, t13 = pick(r, [1, 1, 2]), al = rnd(r, 1, 6) * 5e5, sti = rnd(r, 10, 80) * 1e6, which = pick(r, [2, 3]);
      const c2 = b * 12 + b * t13 + al * 12, a = which === 2 ? c2 : c2 + sti;
      return { q: `Lương cơ bản ${fmt(b / 1e6)} triệu/tháng, thưởng cam kết ${t13} tháng lương, phụ cấp tiền ${fmt(al / 1e6, 1)} triệu/tháng, thưởng hiệu quả năm ${fmt(sti / 1e6)} triệu. Tính COMP${which} (Mercer).`, ans: a / 1e6, unit: 'triệu đồng/năm', dec: 1, tol: 0.06, sol: `COMP1 = ${fmt(b / 1e6)}×12 = ${fmt((b * 12) / 1e6)}; COMP2 = COMP1 + ${fmt((b * t13) / 1e6)} + ${fmt((al * 12) / 1e6, 1)} = ${fmt(c2 / 1e6, 1)}${which === 3 ? `; COMP3 = COMP2 + ${fmt(sti / 1e6)} = ${fmt(a / 1e6, 1)}` : ''} triệu.`, v: { b, t13, al, sti, which } };
    },
  },
  {
    id: 'C-pit', bai: 'Bổ sung', name: 'Thuế TNCN 2026', sup: true,
    gen(r) {
      const g = rnd(r, 16, 50) * 1e6, dep = pick(r, [0, 0, 1, 2]);
      const ins = g * PIT_2026.employeeIns, ti = Math.max(0, g - ins - PIT_2026.personal - dep * PIT_2026.dependant);
      const tax = progressiveTax(ti);
      return { q: `Lương đóng BH ${fmt(g / 1e6)} triệu/tháng (dưới trần), ${dep} người phụ thuộc, không có thu nhập khác. Thuế TNCN tháng theo quy định 2026 là bao nhiêu?`, ans: Math.round(tax), unit: 'đồng', dec: 0, tol: 1500, sol: `BH người lao động 10,5% = ${fmt(ins)} đ. Thu nhập tính thuế = ${fmt(g)} − ${fmt(ins)} − 15.500.000${dep ? ` − ${dep}×6.200.000` : ''} = ${fmt(ti)} đ. Thuế theo biểu 5 bậc (5/10/20/30/35%) = ${fmt(Math.round(tax))} đ.`, v: { g, dep } };
    },
  },
  {
    id: 'C-ins', bai: 'Bổ sung', name: 'Chi phí bảo hiểm doanh nghiệp', sup: true,
    gen(r) {
      const g = rnd(r, 8, 45) * 1e6;
      const a = g * PIT_2026.employerIns;
      return { q: `Lương đóng bảo hiểm ${fmt(g / 1e6)} triệu/tháng (dưới trần). Doanh nghiệp đóng BHXH + BHYT + BHTN bao nhiêu mỗi tháng?`, ans: a / 1e6, unit: 'triệu đồng', dec: 3, tol: 0.002, sol: `21,5% × ${fmt(g / 1e6)} = ${fmt(a / 1e6, 3)} triệu (BHXH 17,5% + BHYT 3% + BHTN 1%; chưa gồm KPCĐ 2%).`, v: { g } };
    },
  },
];
