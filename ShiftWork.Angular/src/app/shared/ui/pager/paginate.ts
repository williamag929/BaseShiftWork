export function paginate<T>(items: readonly T[], page: number, pageSize: number): T[] {
  if (items.length === 0 || pageSize < 1) {
    return [];
  }
  const lastPage = Math.ceil(items.length / pageSize);
  const current = Math.min(Math.max(Math.trunc(page) || 1, 1), lastPage);
  const start = (current - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
