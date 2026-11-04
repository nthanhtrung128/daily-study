import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPersisted, requestPersist, requestPersistOnce, resetPersistAskForTest, storageUsage } from '../../src/core/persist';
import { StorageInfo } from '../../src/ui/components/StorageInfo';
import { Progress } from '../../src/core/progress';
import { StudyDB } from '../../src/core/db';

const mockSm = (persisted: boolean, grant = true, usage: number | undefined = 1_572_864) => ({
  persisted: vi.fn().mockResolvedValue(persisted),
  persist: vi.fn().mockResolvedValue(grant),
  estimate: vi.fn().mockResolvedValue({ usage, quota: 1e9 }),
});
const setStorage = (v: unknown) => Object.defineProperty(navigator, 'storage', { value: v, configurable: true });

afterEach(() => {
  setStorage(undefined);
  resetPersistAskForTest();
});

describe('lưu trữ bền vững', () => {
  it('không có API → null, không lỗi', async () => {
    expect(await requestPersist({})).toBeNull();
    expect(await isPersisted({})).toBeNull();
    expect(await storageUsage({})).toBeNull();
    expect(await requestPersist(undefined)).toBeNull();
  });

  it('chưa bật → gọi persist(); đã bật → không gọi lại', async () => {
    const a = mockSm(false, true);
    expect(await requestPersist({ storage: a })).toBe(true);
    expect(a.persist).toHaveBeenCalledTimes(1);
    const b = mockSm(true);
    expect(await requestPersist({ storage: b })).toBe(true);
    expect(b.persist).not.toHaveBeenCalled();
    const c = mockSm(false, false);
    expect(await requestPersist({ storage: c })).toBe(false);
  });

  it('API ném lỗi → null', async () => {
    const s = { persisted: vi.fn().mockRejectedValue(new Error('x')), persist: vi.fn(), estimate: vi.fn().mockRejectedValue(new Error('x')) };
    expect(await requestPersist({ storage: s })).toBeNull();
    expect(await storageUsage({ storage: s })).toBeNull();
  });

  it('chỉ xin một lần mỗi lần mở app', async () => {
    const s = mockSm(false);
    requestPersistOnce({ storage: s });
    requestPersistOnce({ storage: s });
    await vi.waitFor(() => expect(s.persist).toHaveBeenCalledTimes(1));
  });

  it('lượt chấm đầu tiên xin lưu trữ bền vững', async () => {
    const s = mockSm(false);
    setStorage(s);
    const p = new Progress(new StudyDB('test-persist'));
    await p.load();
    p.grade('tr:K001', 2);
    p.grade('tr:K002', 2);
    await vi.waitFor(() => expect(s.persist).toHaveBeenCalledTimes(1));
    await p.flush();
  });
});

describe('Cài đặt → khối Dữ liệu', () => {
  it('chưa bật: hiện "chưa bật" + gợi ý Màn hình chính, dung lượng vi-VN', async () => {
    setStorage(mockSm(false, false));
    render(<StorageInfo />);
    expect(await screen.findByTestId('storage-persist')).toHaveTextContent('Lưu trữ bền vững: chưa bật — Thêm vào Màn hình chính để iOS không tự xóa dữ liệu.');
    expect(await screen.findByTestId('storage-usage')).toHaveTextContent('Dung lượng đang dùng: 1,5 MB');
  });

  it('đã bật: không có gợi ý', async () => {
    setStorage(mockSm(true));
    render(<StorageInfo />);
    expect(await screen.findByTestId('storage-persist')).toHaveTextContent(/^Lưu trữ bền vững: đã bật\.$/);
  });

  it('không có API: ẩn hẳn', async () => {
    render(<StorageInfo />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('storage-info')).toBeNull();
  });
});
