import { db as defaultDb, type DayStat, type StudyDB } from './db';
import { dayKey } from './date';
import { applyGrade, type Grade, type LeitnerState } from './leitner';
import { streakCount } from './streak';

/**
 * Tiến độ trong bộ nhớ, đồng bộ xuống IndexedDB.
 * Đọc hết một lần lúc mở app (vài trăm mục), ghi từng lượt chấm ngay sau khi chấm.
 * Giao diện đăng ký qua `subscribe` (dùng với useSyncExternalStore).
 */
export class Progress {
  private states = new Map<string, LeitnerState>();
  private days = new Map<string, DayStat>();
  private notes = new Map<string, string>();
  private listeners = new Set<() => void>();
  private version = 0;
  private pending: Promise<unknown> = Promise.resolve();
  loaded = false;

  constructor(
    private store: StudyDB = defaultDb,
    private now: () => Date = () => new Date(),
  ) {}

  /** Đọc từ IndexedDB. `reset` (sau khi nhập tiến độ): bỏ dữ liệu trong bộ nhớ, đọc lại toàn bộ. */
  async load(reset = false): Promise<void> {
    if (reset) await this.pending;
    try {
      const [items, days, notes] = await Promise.all([
        this.store.items.toArray(),
        this.store.days.toArray(),
        this.store.notes.toArray(),
      ]);
      if (reset) {
        this.states.clear();
        this.days.clear();
        this.notes.clear();
      }
      for (const { id, box, due, wrong, last } of items) this.states.set(id, { box, due, wrong, last });
      for (const d of days) this.days.set(d.day, d);
      for (const n of notes) this.notes.set(n.id, n.text);
    } catch {
      /* IndexedDB bị chặn (chế độ riêng tư cũ): vẫn chạy trong bộ nhớ */
    }
    this.loaded = true;
    this.emit();
  }

  today(): string {
    return dayKey(this.now());
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;

  private emit() {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  private persist(job: () => Promise<unknown>) {
    this.pending = this.pending.then(job).catch(() => undefined);
  }

  /** Chờ các lần ghi IndexedDB xong (dùng trong test). */
  flush(): Promise<unknown> {
    return this.pending;
  }

  stateOf = (id: string): LeitnerState | undefined => this.states.get(id);

  entries(): IterableIterator<[string, LeitnerState]> {
    return this.states.entries();
  }

  /** Mọi ngày có thống kê (bản đồ nhiệt, tổng lượt ôn). */
  allDays(): IterableIterator<DayStat> {
    return this.days.values();
  }

  dayStat(day: string): DayStat {
    return this.days.get(day) ?? { day, n: 0, ok: 0, s: 0 };
  }

  /** Số mục mới đã học hôm nay. */
  newToday(): number {
    return this.dayStat(this.today()).nw ?? 0;
  }

  streak(): number {
    return streakCount((d) => this.days.get(d)?.n ?? 0, this.today());
  }

  grade(id: string, g: Grade): LeitnerState {
    const t = this.today();
    const at = this.now().getTime();
    const prev = this.states.get(id);
    const next = applyGrade(prev, g, t, at);
    this.states.set(id, next);
    const d = { ...this.dayStat(t) };
    d.n++;
    if (g === 2) d.ok++;
    if (!prev?.box) d.nw = (d.nw ?? 0) + 1;
    this.days.set(t, d);
    this.emit();
    this.persist(() =>
      this.store.transaction('rw', this.store.items, this.store.reviews, this.store.days, async () => {
        await this.store.items.put({ id, ...next });
        await this.store.reviews.add({ itemId: id, day: t, grade: g, at });
        await this.store.days.put(d);
      }),
    );
    return next;
  }

  addSeconds(secs: number): void {
    const t = this.today();
    const d = { ...this.dayStat(t), s: this.dayStat(t).s + secs };
    this.days.set(t, d);
    this.emit();
    this.persist(() => this.store.days.put(d));
  }

  note(id: string): string {
    return this.notes.get(id) ?? '';
  }

  /** Lưu ghi chú; để trống thì xóa (như bản cũ). */
  setNote(id: string, text: string): void {
    if (text.trim()) {
      this.notes.set(id, text);
      this.persist(() => this.store.notes.put({ id, text, at: Date.now() }));
    } else {
      this.notes.delete(id);
      this.persist(() => this.store.notes.delete(id));
    }
    this.emit();
  }
}

export const progress = new Progress();
