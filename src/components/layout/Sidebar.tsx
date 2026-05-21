import React, { useCallback, useState } from 'react';
import { LayoutGrid, Settings, Upload, X, Loader2, CheckCircle2, AlertCircle, Lock, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useCategoriesContext, CategoryWithChildren } from '../../contexts/CategoriesContext';
import { useConfigContext } from '../../contexts/ConfigContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { useLinksContext } from '../../contexts/LinksContext';
import Icon from '../../../components/Icon';
import { Category } from '../../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeCategoryId: string | null;
  onOpenCatManager: () => void;
  onOpenBackup: () => void;
  onUnlockCategory: (cat: Category) => void;
}

export function Sidebar({ isOpen, onClose, activeCategoryId, onOpenCatManager, onOpenBackup, onUnlockCategory }: SidebarProps) {
  const { categoryTree, expandedCategories, toggleExpand, unlockedCategoryIds } = useCategoriesContext();
  const { showPinnedWebsites, ai } = useConfigContext();
  const { authToken } = useAuthContext();
  const { syncStatus } = useLinksContext();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCategoryClick = useCallback((cat: CategoryWithChildren) => {
    if (cat.children && cat.children.length > 0) {
      toggleExpand(cat.id);
      const targetId = cat.children[0]?.id || cat.id;
      document.getElementById(`cat-${targetId}`)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth' });
    }
    onClose();
  }, [toggleExpand, onClose]);

  const renderCategoryNode = (cat: CategoryWithChildren, level: number = 0) => {
    const isExpanded = expandedCategories.has(cat.id);
    const isActive = activeCategoryId === cat.id;
    const hasChildren = cat.children && cat.children.length > 0;
    const isLocked = cat.password && !unlockedCategoryIds.has(cat.id);

    return (
      <div key={cat.id}>
        <button
          onClick={() => handleCategoryClick(cat)}
          className={`w-full flex items-center cursor-pointer py-2.5 rounded-xl transition-all group ${
            isActive
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
          } ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}
          style={isCollapsed ? {} : { paddingLeft: `${level * 12 + 16}px` }}
          title={isCollapsed ? cat.name : undefined}
        >
          <div className={`p-1.5 rounded-lg transition-colors flex items-center justify-center shrink-0 ${
            isActive ? 'bg-blue-100 dark:bg-blue-800' : 'bg-slate-100 dark:bg-slate-800'
          }`}>
            {isLocked ? <Lock size={16} className="text-amber-500" /> : <Icon name={cat.icon} size={16} />}
          </div>
          <div className={`flex flex-1 items-center overflow-hidden transition-all ease-in-out ${isCollapsed ? 'max-w-0 opacity-0 ml-0 duration-150' : 'max-w-[200px] opacity-100 ml-3 duration-300 delay-150'}`}>
            <span className="truncate flex-1 text-left">{cat.name}</span>
            {hasChildren && (
              <span className="text-slate-400 ml-2">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            )}
            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-2 shrink-0"></div>}
          </div>
        </button>

        {hasChildren && isExpanded && !isCollapsed && (
          <div className="space-y-1 mt-1">
            {cat.children.map(child => renderCategoryNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden backdrop-blur-sm cursor-pointer" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 ${isCollapsed ? 'w-16' : 'w-64 lg:w-48 xl:w-64'} transform transition-all duration-300 ease-in-out bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-x-hidden ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-center relative border-b border-slate-100 dark:border-slate-700 shrink-0 transition-all duration-300">
          <span 
            className={`text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent flex items-center h-full whitespace-nowrap overflow-hidden transition-all ease-in-out ${
              isCollapsed ? 'max-w-0 opacity-0 duration-150' : 'max-w-[200px] opacity-100 duration-300 delay-150'
            }`}
          >
            {ai?.sidebarNavigationName || ai?.navigationName || '蜗牛导航'}
          </span>
          {isCollapsed && (
            <button onClick={() => setIsCollapsed(false)} className="hidden lg:flex absolute p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors" title="展开侧边栏">
              <PanelLeftOpen size={20} />
            </button>
          )}
          {!isCollapsed && (
            <button onClick={() => setIsCollapsed(true)} className="hidden lg:flex absolute right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors" title="折叠侧边栏">
              <PanelLeftClose size={18} />
            </button>
          )}
          <button onClick={onClose} className="lg:hidden absolute right-4 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
          {/* 置顶网站 */}
          {showPinnedWebsites && (
            <button
              onClick={() => {
                document.getElementById('cat-pinned')?.scrollIntoView({ behavior: 'smooth' });
                onClose();
              }}
              className={`w-full flex items-center py-3 rounded-xl transition-all cursor-pointer ${
                activeCategoryId === 'pinned'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              } ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}
              title={isCollapsed ? '置顶网站' : undefined}
            >
              <div className="p-1 shrink-0"><Icon name="LayoutGrid" size={18} /></div>
              <span className={`whitespace-nowrap overflow-hidden text-left transition-all ease-in-out ${isCollapsed ? 'max-w-0 opacity-0 ml-0 duration-150' : 'max-w-[200px] opacity-100 ml-3 duration-300 delay-150'}`}>置顶网站</span>
            </button>
          )}

          {/* 分类目录标题 */}
          <div className={`flex items-center justify-between px-4 transition-all duration-300 overflow-hidden ${isCollapsed ? 'h-0 opacity-0 mt-0 mb-0' : 'h-10 mt-4 mb-2 opacity-100'}`}>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">分类目录</span>
            {authToken && (
              <button
                onClick={onOpenCatManager}
                className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                title="管理分类"
              >
                <Settings size={14} />
              </button>
            )}
          </div>
          <div className={`mx-2 border-b border-slate-100 dark:border-slate-700/50 transition-all duration-300 ${isCollapsed ? 'mb-4 mt-2' : 'mb-0 mt-0 h-0 border-transparent opacity-0'}`}></div>

          {/* 分类树 */}
          {categoryTree.map(cat => renderCategoryNode(cat, 0))}
        </div>

        {/* Footer - Spacer or simple copyright if needed */}
        <div className="flex-shrink-0" />
      </aside>
    </>
  );
}
