import { useEffect, useSyncExternalStore } from 'react';
import { getSetting, setSetting } from '../../core/db';
import { clampRate, tts, type Accent } from './tts';

/** Cài đặt đọc (giọng Mỹ/Anh, tốc độ) — lưu trong bảng settings của IndexedDB. */
export interface TtsPrefs {
  accent: Accent;
  rate: number;
}
export const DEFAULT_TTS: TtsPrefs = { accent: 'en-US', rate: 0.85 };
const KEY = 'en.tts';

let prefs: TtsPrefs = DEFAULT_TTS;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getPrefs = () => prefs;

function load() {
  if (loaded) return;
  loaded = true;
  void getSetting<Partial<TtsPrefs>>(KEY, {})
    .then((v) => {
      prefs = { ...DEFAULT_TTS, ...prefs, ...v, rate: clampRate(v.rate ?? prefs.rate) };
      emit();
    })
    .catch(() => undefined);
}

export function setTtsPrefs(patch: Partial<TtsPrefs>): void {
  prefs = { ...prefs, ...patch, rate: clampRate(patch.rate ?? prefs.rate) };
  emit();
  void setSetting(KEY, prefs).catch(() => undefined);
}

export function useTtsPrefs(): TtsPrefs {
  useEffect(load, []);
  return useSyncExternalStore(subscribe, getPrefs, getPrefs);
}

/** Gắn vòng đời: tải danh sách giọng, hủy đọc khi rời trang và khi component unmount. */
export function useTtsLifecycle(): void {
  useEffect(() => {
    tts.warm();
    const off = tts.bindPageLifecycle();
    return () => {
      off();
      tts.cancel();
    };
  }, []);
}

const getSpeaking = () => tts.speaking;
export function useSpeaking(): boolean {
  return useSyncExternalStore(tts.subscribe, getSpeaking, getSpeaking);
}

/** Đọc một câu theo cài đặt hiện tại. Gọi trực tiếp trong onClick (iOS). */
export function say(text: string): void {
  void tts.speak(text, { rate: prefs.rate, accent: prefs.accent });
}
