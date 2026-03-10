import { useState, useCallback } from 'react';

export function useSelection() {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const togglePage = useCallback((pageItems: { id: number }[]) => {
    setSelected(prev => {
      const allSelected = pageItems.length > 0 && pageItems.every(item => prev.has(item.id));
      const next = new Set(prev);
      if (allSelected) {
        pageItems.forEach(item => next.delete(item.id));
      } else {
        pageItems.forEach(item => next.add(item.id));
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const isAllSelected = useCallback(
    (pageItems: { id: number }[]) => pageItems.length > 0 && pageItems.every(item => selected.has(item.id)),
    [selected]
  );

  return { selected, toggle, togglePage, clear, isAllSelected, count: selected.size };
}
