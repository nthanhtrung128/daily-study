import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { clamp01 } from '../../src/core/num';

describe('App', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('mở mặc định ở Hôm nay, có đủ 5 tab', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hôm nay ôn bao lâu?');
    const tabs = within(screen.getByRole('navigation')).getAllByRole('link');
    expect(tabs.map((t) => t.textContent)).toEqual(['Hôm nay', 'Tra cứu', 'Lộ trình', 'Tiến độ', 'Cài đặt']);
    expect(screen.getByRole('link', { name: 'Hôm nay' })).toHaveAttribute('aria-current', 'page');
  });

  it('đổi trang theo hash', async () => {
    render(<App />);
    await act(async () => {
      window.location.hash = '#cai-dat';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cài đặt');
    expect(screen.getByRole('link', { name: 'Cài đặt' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('clamp01', () => {
  it('giới hạn 0–1', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.3)).toBe(0.3);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});
