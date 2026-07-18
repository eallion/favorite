import { useCallback } from 'react';
import { DragEndEvent, PointerSensor, useSensor, useSensors, KeyboardSensor } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { LinkItem } from '../../types';
import { useLinksContext } from '../contexts/LinksContext';
import { useCategoriesContext } from '../contexts/CategoriesContext';

export function useDragSort() {
  const { links = [], setLinksAndSync } = useLinksContext();
  const { categories = [] } = useCategoriesContext();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent, categoryId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const categoryLinks = links
      .filter(l => l.categoryId === categoryId && !l.pinned)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const oldIndex = categoryLinks.findIndex(l => l.id === active.id);
    const newIndex = categoryLinks.findIndex(l => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered: LinkItem[] = arrayMove(categoryLinks, oldIndex, newIndex);
    // 只更新当前分类的链接顺序，不影响其他分类
    const reorderedMap = new Map(reordered.map((l, i) => [l.id, i]));
    const updatedLinks = links.map(link => {
      if (reorderedMap.has(link.id)) {
        return { ...link, order: reorderedMap.get(link.id) } as LinkItem;
      }
      return link;
    });

    setLinksAndSync(updatedLinks, categories);
  }, [links, categories, setLinksAndSync]);

  const handlePinnedDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const pinnedLinks = links
      .filter(l => l.pinned)
      .sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0));

    const oldIndex = pinnedLinks.findIndex(l => l.id === active.id);
    const newIndex = pinnedLinks.findIndex(l => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered: LinkItem[] = arrayMove(pinnedLinks, oldIndex, newIndex);
    const updatedLinks = links.map(link => {
      const idx = reordered.findIndex(l => l.id === link.id);
      if (idx !== -1) return { ...link, pinnedOrder: idx };
      return link;
    });

    setLinksAndSync(updatedLinks, categories);
  }, [links, categories, setLinksAndSync]);

  return { sensors, handleDragEnd, handlePinnedDragEnd };
}
