import React from 'react';
import { DndContext, closestCenter, DragEndEvent, SensorDescriptor } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { LinkItem, Category } from '../../../types';
import { CategoryWithChildren } from '../../contexts/CategoriesContext';
import { LinkCard } from '../link/LinkCard';

interface CategorySectionProps {
  category: CategoryWithChildren;
  links: LinkItem[];
  subcategoryLinks: LinkItem[];
  viewMode: 'compact' | 'detailed';
  isBatchEditMode: boolean;
  selectedLinks: Set<string>;
  onToggleSelection: (id: string) => void;
  onEditLink: (link: LinkItem) => void;
  onDeleteLink: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, link: LinkItem) => void;
  onDragEnd: (event: DragEndEvent, categoryId: string) => void;
  sensors: SensorDescriptor<any>[];
  authToken?: string | null;
  isDraggable?: boolean;
  isEditMode?: boolean;
  onWeightChange?: (linkId: string, weight: number) => void;
}

export function CategorySection({
  category, links, subcategoryLinks, viewMode,
  isBatchEditMode, selectedLinks, onToggleSelection,
  onEditLink, onDeleteLink, onContextMenu, onDragEnd, sensors,
  authToken, isDraggable = false, isEditMode = false, onWeightChange,
}: CategorySectionProps) {
  const allLinks = [...links, ...subcategoryLinks];

  if (allLinks.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    onDragEnd(event, category.id);
  };

  const gridClass = viewMode === 'detailed'
    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10';

  return (
    <section id={`cat-${category.id}`} className="mb-8 scroll-mt-20">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-4">
        <span>{category.name}</span>
        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
          {allLinks.length}
        </span>
      </h2>

      {/* Category's own links */}
      {links.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={links.map(l => l.id)} strategy={rectSortingStrategy}>
            <div className={`grid gap-3 ${gridClass}`}>
              {links.map(link => (
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
      )}

      {/* Subcategory links */}
      {category.children?.map(child => {
        const childLinks = subcategoryLinks.filter(l => l.categoryId === child.id);
        if (childLinks.length === 0) return null;

        return (
          <div key={child.id} id={`cat-${child.id}`} className="mt-6 scroll-mt-20">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2 mb-3">
              <span>{child.name}</span>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full">
                {childLinks.length}
              </span>
            </h3>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e, child.id)}>
              <SortableContext items={childLinks.map(l => l.id)} strategy={rectSortingStrategy}>
                <div className={`grid gap-3 ${gridClass}`}>
                  {childLinks.map(link => (
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
      })}
    </section>
  );
}
