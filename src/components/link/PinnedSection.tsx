import React from 'react';
import { DndContext, closestCenter, DragEndEvent, SensorDescriptor } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { Pin } from 'lucide-react';
import { LinkItem } from '../../../types';
import { LinkCard } from './LinkCard';

interface PinnedSectionProps {
  links: LinkItem[];
  viewMode?: 'compact' | 'detailed';
  isBatchEditMode: boolean;
  selectedLinks: Set<string>;
  onToggleSelection: (id: string) => void;
  onEditLink: (link: LinkItem) => void;
  onDeleteLink: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, link: LinkItem) => void;
  onDragEnd: (event: DragEndEvent) => void;
  sensors: SensorDescriptor<any>[];
  authToken?: string | null;
  isDraggable?: boolean;
  isEditMode?: boolean;
  onWeightChange?: (linkId: string, weight: number) => void;
}

export function PinnedSection({
  links, viewMode = 'compact', isBatchEditMode, selectedLinks, onToggleSelection,
  onEditLink, onDeleteLink, onContextMenu, onDragEnd, sensors, authToken,
  isDraggable = false, isEditMode = false, onWeightChange,
}: PinnedSectionProps) {
  const sortedLinks = [...(links || [])].sort((a, b) => {
    // 先按 weight 降序（数值大的靠前），再按 pinnedOrder 升序
    const weightDiff = (b.weight ?? 0) - (a.weight ?? 0);
    if (weightDiff !== 0) return weightDiff;
    return (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0);
  });

  const gridClass = viewMode === 'detailed'
    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10';

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Pin size={16} className="text-blue-500 fill-blue-500" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          置顶 / 常用
        </h2>
        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
          {links.length}
        </span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sortedLinks.map(l => l.id)} strategy={rectSortingStrategy}>
          <div className={`grid gap-3 ${gridClass}`}>
            {sortedLinks.map(link => (
              <LinkCard
                key={link.id}
                link={link}
                viewMode={viewMode}
                isBatchEditMode={isBatchEditMode}
                isSelected={selectedLinks.has(link.id)}
                onToggleSelection={onToggleSelection}
                onEdit={onEditLink}
                onDelete={onDeleteLink}
                onContextMenu={onContextMenu}
                authToken={authToken}
                isDraggable={isDraggable}
                isEditMode={isEditMode}
                onWeightChange={onWeightChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
