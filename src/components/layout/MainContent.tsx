import React, { useEffect, useState, useCallback } from 'react';
import { useLinksContext } from '../../contexts/LinksContext';
import { useCategoriesContext } from '../../contexts/CategoriesContext';
import { useConfigContext } from '../../contexts/ConfigContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { useDragSort } from '../../hooks/useDragSort';
import { CategorySection } from '../category/CategorySection';
import { PinnedSection } from '../link/PinnedSection';
import { LinkCard } from '../link/LinkCard';
import { LinkItem } from '../../../types';

interface MainContentProps {
  searchQuery: string;
  searchResults: LinkItem[];
  isBatchEditMode: boolean;
  selectedLinks: Set<string>;
  onToggleSelection: (id: string) => void;
  onEditLink: (link: LinkItem) => void;
  onDeleteLink: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, link: LinkItem) => void;
  isDragSortMode: boolean;
  isEditMode: boolean;
  onWeightChange: (linkId: string, weight: number) => void;
  isInternal: boolean;
}

export function MainContent({
  searchQuery, searchResults, isBatchEditMode, selectedLinks,
  onToggleSelection, onEditLink, onDeleteLink, onContextMenu,
  isDragSortMode, isEditMode, onWeightChange, isInternal,
}: MainContentProps) {
  const { links = [], pinnedLinks = [], getLinksByCategory } = useLinksContext();
  const { categoryTree = [], categories = [] } = useCategoriesContext();
  const { showPinnedWebsites = true, viewMode = 'compact' } = useConfigContext();
  const { authToken } = useAuthContext();
  const { sensors, handleDragEnd, handlePinnedDragEnd } = useDragSort();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const safeGetLinksByCategory = useCallback((categoryId: string) => {
    return getLinksByCategory ? getLinksByCategory(categoryId) : [];
  }, [getLinksByCategory]);

  // Intersection Observer for active category highlighting
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace('cat-', '');
            setActiveCategory(id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );

    const sections = document.querySelectorAll('[id^="cat-"]');
    sections.forEach(section => observer.observe(section));

    return () => observer.disconnect();
  }, [links, categories]);

  const gridClass = viewMode === 'detailed'
    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10';

  // Search mode: Only show results if internal search is checked
  if (searchQuery.trim() && isInternal) {
    return (
      <main className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8">
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-4">
            搜索结果
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
              {searchResults.length}
            </span>
          </h2>
          <div className={`grid gap-3 ${gridClass}`}>
            {searchResults.map(link => (
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
                isEditMode={isEditMode}
                onWeightChange={onWeightChange}
                isDraggable={false}
              />
            ))}
          </div>
          {searchResults.length === 0 && (
            <p className="text-slate-500 text-center py-12">未找到匹配的链接</p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8">
      {/* Pinned section */}
      {showPinnedWebsites && pinnedLinks.length > 0 && (
        <section id="cat-pinned">
          <PinnedSection
            links={pinnedLinks}
            viewMode={viewMode}
            isBatchEditMode={isBatchEditMode}
            selectedLinks={selectedLinks}
            onToggleSelection={onToggleSelection}
            onEditLink={onEditLink}
            onDeleteLink={onDeleteLink}
            onContextMenu={onContextMenu}
            onDragEnd={handlePinnedDragEnd}
            sensors={sensors}
            authToken={authToken}
            isDraggable={isDragSortMode}
            isEditMode={isEditMode}
            onWeightChange={onWeightChange}
          />
        </section>
      )}

      {/* All categories */}
      {categoryTree.map(cat => {
        const catLinks = safeGetLinksByCategory(cat.id);
        const subcategoryLinks = cat.children?.flatMap(child => safeGetLinksByCategory(child.id)) || [];

        return (
          <CategorySection
            key={cat.id}
            category={cat}
            links={catLinks}
            subcategoryLinks={subcategoryLinks}
            viewMode={viewMode}
            isBatchEditMode={isBatchEditMode}
            selectedLinks={selectedLinks}
            onToggleSelection={onToggleSelection}
            onEditLink={onEditLink}
            onDeleteLink={onDeleteLink}
            onContextMenu={onContextMenu}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            authToken={authToken}
            isDraggable={isDragSortMode}
            isEditMode={isEditMode}
            onWeightChange={onWeightChange}
          />
        );
      })}
    </main>
  );
}
