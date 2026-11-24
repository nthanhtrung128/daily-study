import { expect, test } from 'vitest';
import { allReadings, findReadings, keepReadingFilters, readReadingFilters } from '../../src/modules/english/readingSearch';

test('ưu tiên tên bài, tìm được chữ trong đoạn ở cả hai ngôn ngữ và áp dụng nguồn đồng thời', () => {
  const find = (query: string) => findReadings({ ...allReadings, query }).map(a => a.id);
  expect(find('  PHU  CAP CA ')[0]).toBe('kiem-tra-phu-cap-ca');
  expect(find('phu cap ca')).not.toContain('on-lai-trong-so');
  expect(find('phu cap ca')).not.toContain('chuyen-dau-gio');
  expect(find('last b')).toContain('kiem-tra-phu-cap-ca');
  expect(find('last bus')).toContain('kiem-tra-phu-cap-ca');
  expect(find('chuyen xe buyt')).toContain('kiem-tra-phu-cap-ca');
  expect(findReadings({ region: 'Việt Nam', query: 'last bus' }).map(a => a.id)).not.toContain('kiem-tra-phu-cap-ca');
  expect(find('khongtimthayxyz')).toEqual([]);
});

test('giữ đúng từ khóa và nguồn khi mở lại thư viện trong cùng thẻ', () => {
  const filters = { region: 'Quốc tế', query: 'bàn giao' } as const;
  keepReadingFilters(filters);
  expect(readReadingFilters()).toEqual(filters);
  keepReadingFilters(allReadings);
  expect(readReadingFilters()).toEqual(allReadings);
});
