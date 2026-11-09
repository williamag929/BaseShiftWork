import { paginate } from './paginate';

describe('paginate', () => {
  const items = Array.from({ length: 120 }, (_, i) => i + 1);

  it('returns the first page', () => {
    const page = paginate(items, 1, 25);
    expect(page.length).toBe(25);
    expect(page[0]).toBe(1);
    expect(page[24]).toBe(25);
  });

  it('returns a short last page', () => {
    const page = paginate(items, 5, 25);
    expect(page.length).toBe(20);
    expect(page[0]).toBe(101);
  });

  it('clamps out-of-range pages to the last page', () => {
    expect(paginate(items, 99, 25)).toEqual(paginate(items, 5, 25));
  });

  it('clamps pages below 1 to the first page', () => {
    expect(paginate(items, 0, 25)[0]).toBe(1);
  });

  it('returns an empty array for empty input', () => {
    expect(paginate([], 1, 25)).toEqual([]);
    expect(paginate([], 7, 25)).toEqual([]);
  });
});
