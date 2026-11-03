import { db as defaultDb, isQuotaError, type DayStat, type ItemState, type Note, type StudyDB } from './db';
import { dayKey } from './date';
import { applyGrade, type Grade, type LeitnerState } from './leitner';
import { streakCount } from './streak';

/**
 * Sự cố lưu trữ để báo người dùng: `unavailable` = không mở được IndexedDB (chế độ riêng tư cũ, bị chặn),
 * `quota` = bộ nhớ đầy, `write` = ghi lỗi khác. App vẫn chạy trong bộ nhớ, chỉ không lưu.
 */
export type StorageProblem = 'unavailable' | 'quota' | 'write';

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
  private loadP: Promise<void> | null = null;
  /** Thay đổi làm trước khi đọc xong IndexedDB (xem `run`). */
  private early: (() => () => Promise<unknown>)[] = [];
  loaded = false;
  problem: StorageProblem | null = null;

  constructor(
    private store: StudyDB = defaultDb,
    private now: () => Date = () => new Date(),
  ) {}

  /**
   * Đọc từ IndexedDB (một lần; gọi nhiều lần trong lúc đang đọc trả về cùng một promise).
   * `reset` (sau khi nhập tiến độ): bỏ dữ liệu trong bộ nhớ, đọc lại toàn bộ.
   */
  load(reset = false): Promise<void> {
    if (!reset) return (this.loadP ??= this.read(false));
    return (this.loadP = this.read(true));
  }

  private async read(reset: boolean): Promise<void> {
    if (reset) await this.pending;
    let rows: [ItemState[], DayStat[], Note[]] | null = null;
    try {
      rows = await Promise.all([this.store.items.toArray(), this.store.days.toArray(), this.store.notes.toArray()]);
      if (this.problem === 'unavailable') this.problem = null;
    } catch {
      // IndexedDB bị chặn (chế độ riêng tư cũ, hỏng): vẫn chạy trong bộ nhớ, báo cho người dùng.
      this.problem = 'unavailable';
    }
    const early = this.early;
    this.early = [];
    if (rows) {
      const [items, days, notes] = rows;
      this.states.clear();
      this.days.clear();
      this.notes.clear();
      for (const { id, box, due, wrong, last } of items) this.states.set(id, { box, due, wrong, last });
      for (const d of days) this.days.set(d.day, d);
      for (const n of notes) this.notes.set(n.id, n.text);
      // Lượt chấm / ghi chú làm trước khi đọc xong: áp lại lên dữ liệu vừa đọc rồi mới ghi xuống,
      // để dữ liệu đọc về không ghi đè chúng (và chúng không ghi đè thống kê cũ trong máy).
      for (const op of early) this.persist(op());
    }
    this.loaded = true;
    this.emit();
  }

  /** Áp một thay đổi vào bộ nhớ ngay; ghi xuống IndexedDB nếu đã đọc xong, không thì xếp hàng chờ `load`. */
  private run(op: () => () => Promise<unknown>): void {
    const job = op();
    if (this.loaded) this.persist(job);
    else this.early.push(op);
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
    this.pending = this.pending.then(job).catch((e: unknown) => {
      if (this.problem !== 'unavailable') {
        this.problem = isQuotaError(e) ? 'quota' : 'write';
        this.emit();
      }
    });
  }

  /** Người dùng đã đọc thông báo sự cố lưu trữ. */
  dismissProblem(): void {
    this.problem = null;
    this.emit();
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
    let out: LeitnerState | undefined;
    this.run(() => {
      const prev = this.states.get(id);
      const next = applyGrade(prev, g, t, at);
      out ??= next;
      this.states.set(id, next);
      const d = { ...this.dayStat(t) };
      d.n++;
      if (g === 2) d.ok++;
      if (!prev?.box) d.nw = (d.nw ?? 0) + 1;
      this.days.set(t, d);
      return () =>
        this.store.transaction('rw', this.store.items, this.store.reviews, this.store.days, async () => {
          await this.store.items.put({ id, ...next });
          await this.store.reviews.add({ itemId: id, day: t, grade: g, at });
          await this.store.days.put(d);
        });
    });
    return out!;
  }

  addSeconds(secs: number): void {
    const t = this.today();
    this.run(() => {
      const d = { ...this.dayStat(t), s: this.dayStat(t).s + secs };
      this.days.set(t, d);
      return () => this.store.days.put(d);
    });
  }

  note(id: string): string {
    return this.notes.get(id) ?? '';
  }

  /** Lưu ghi chú; để trống thì xóa (như bản cũ). */
  setNote(id: string, text: string): void {
    const at = Date.now();
    this.run(() => {
      if (text.trim()) {
        this.notes.set(id, text);
        return () => this.store.notes.put({ id, text, at });
      }
      this.notes.delete(id);
      return () => this.store.notes.delete(id);
    });
  }
}

export const progress = new Progress();
