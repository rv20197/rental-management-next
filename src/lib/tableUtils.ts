export type SortDirection = 'asc' | 'desc';

export function getNextSortDirection(
  currentKey: string,
  currentDirection: SortDirection,
  nextKey: string,
): SortDirection {
  if (currentKey !== nextKey) return 'asc';
  return currentDirection === 'asc' ? 'desc' : 'asc';
}

export function compareValues(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  direction: SortDirection,
) {
  const multiplier = direction === 'asc' ? 1 : -1;

  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;

  if (typeof left === 'number' && typeof right === 'number') {
    return (left - right) * multiplier;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  }) * multiplier;
}
