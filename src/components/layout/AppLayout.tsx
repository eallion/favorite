import React, { useState, useEffect, Suspense, lazy, useCallback, useRef } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import { useLinksContext } from '../../contexts/LinksContext';
import { useCategoriesContext } from '../../contexts/CategoriesContext';
import { useConfigContext } from '../../contexts/ConfigContext';
import { useSearch } from '../../hooks/useSearch';
import { useDataSync } from '../../hooks/useDataSync';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { ContentSkeleton } from './ContentSkeleton';
import { LinkItem, Category } from '../../../types';
import AuthModal from '../../../components/AuthModal';

const LinkModal = lazy(() => import('../../../components/LinkModal'));
const CategoryManagerModal = lazy(() => import('../../../components/CategoryManagerModal'));
const BackupModal = lazy(() => import('../../../components/BackupModal'));
const CategoryAuthModal = lazy(() => import('../../../components/CategoryAuthModal'));
const ImportModal = lazy(() => import('../../../components/ImportModal'));
const SettingsModal = lazy(() => import('../../../components/SettingsModal'));
const SearchConfigModal = lazy(() => import('../../../components/SearchConfigModal'));
const ContextMenu = lazy(() => import('../../../components/ContextMenu'));
const QRCodeModal = lazy(() => import('../../../components/QRCodeModal'));

export function AppLayout() {
  // Contexts
  const { authToken, requiresAuth, isCheckingAuth, capabilities, login, logout } = useAuthContext();
  const { links = [], addLink, updateLink, deleteLink, deleteLinks, setLinksAndSync } = useLinksContext();
  const { categories = [], categoryTree = [], setCategoriesAndSync, unlockedCategoryIds, unlockCategory } = useCategoriesContext();
  const { ai: aiConfig, icon: iconConfig, viewMode, showPinnedWebsites, ticker, weather, website, webdav, search, setAI, setIcon, setWebsite, setShowPinned, setMastodon, setWeather, setWebDav, setSearch, setViewMode } = useConfigContext();

  // Hooks
  const {
    searchQuery, setSearchQuery, searchResults, isMobileSearchOpen, setIsMobileSearchOpen,
    isSearchExpanded, setIsSearchExpanded,
    isInternal, setIsInternal, handleSearch, visitorEngineId, setVisitorEngineId
  } = useSearch();
  const { initData } = useDataSync();

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Toggle States
  const [isDragSortMode, setIsDragSortMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSearchConfigModalOpen, setIsSearchConfigModalOpen] = useState(false);
  const [catAuthModalData, setCatAuthModalData] = useState<Category | null>(null);

  // Edit State
  const [editingLink, setEditingLink] = useState<LinkItem | undefined>(undefined);
  const [prefillLink, setPrefillLink] = useState<Partial<LinkItem> | undefined>(undefined);

  // Batch Edit State
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    link: LinkItem | null;
  }>({ isOpen: false, position: { x: 0, y: 0 }, link: null });

  // QR Code Modal State
  const [qrCodeModal, setQrCodeModal] = useState<{
    isOpen: boolean; url: string; title: string;
  }>({ isOpen: false, url: '', title: '' });

  // Drag sort confirmation state
  const [pendingDragLinks, setPendingDragLinks] = useState<{ links: LinkItem[]; categories: Category[] } | null>(null);

  // ===== 侧滑手势状态（使用 ref 避免闭包陷阱）=====
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({
    startX: 0,
    startY: 0,
    currentX: 0,
    startTime: 0,
    sidebarWasOpen: false,
    isActive: false,
  });
  const SIDEBAR_WIDTH = 256;
  const EDGE_THRESHOLD = 30;
  const OPEN_THRESHOLD = 80;
  const CLOSE_THRESHOLD = 80;

  // ===== Touch 手势处理 =====
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const isEdge = touch.clientX < EDGE_THRESHOLD;
    const isInSidebar = sidebarOpen && touch.clientX < SIDEBAR_WIDTH;

    if (!isEdge && !isInSidebar) return;

    dragState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      startTime: Date.now(),
      sidebarWasOpen: sidebarOpen,
      isActive: true,
    };

    setIsDragging(true);
    setDragOffset(0);
  }, [sidebarOpen]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const state = dragState.current;
    if (!state.isActive || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;

    // 垂直滑动优先，取消拖动
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      state.isActive = false;
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    // 水平滑动距离太小，忽略
    if (Math.abs(deltaX) < 5) return;

    state.currentX = touch.clientX;

    if (state.sidebarWasOpen) {
      // 正在关闭：从 0 向左拖动
      setDragOffset(Math.max(-SIDEBAR_WIDTH, Math.min(0, deltaX)));
    } else {
      // 正在打开：从 -SIDEBAR_WIDTH 向右拖动
      setDragOffset(Math.max(0, Math.min(SIDEBAR_WIDTH, deltaX)));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const state = dragState.current;
    if (!state.isActive) return;

    state.isActive = false;
    const deltaX = state.currentX - state.startX;
    const elapsed = Date.now() - state.startTime;
    const velocity = Math.abs(deltaX) / (elapsed || 1);

    setIsDragging(false);

    if (state.sidebarWasOpen) {
      // 原来是打开的：判断是否关闭
      if (deltaX < -CLOSE_THRESHOLD || (deltaX < -20 && velocity > 0.5)) {
        setSidebarOpen(false);
      }
    } else {
      // 原来是关闭的：判断是否打开
      if (deltaX > OPEN_THRESHOLD || (deltaX > 20 && velocity > 0.5)) {
        setSidebarOpen(true);
      }
    }

    setDragOffset(0);
  }, []);

  // 绑定 touch 事件到 document（capture 阶段，确保侧边栏打开时也能捕获）
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (!isMobile) return;

    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true, capture: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true, capture: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('touchmove', handleTouchMove, true);
      document.removeEventListener('touchend', handleTouchEnd, true);
      document.removeEventListener('touchcancel', handleTouchEnd, true);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Initialize data
  useEffect(() => {
    const init = async () => {
      await initData(unlockedCategoryIds);
      setIsInitialLoading(false);
    };

    // Global keyboard listener for search focus
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' ||
                     activeElement?.tagName === 'TEXTAREA' ||
                     (activeElement as HTMLElement)?.isContentEditable;

      if (isInput) return;

      if (e.key === 'Escape') {
        if (isSearchExpanded) {
          setIsSearchExpanded(false);
          setSearchQuery('');
          document.getElementById('search-input')?.blur();
        }
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1 && e.key !== 'Process') return;

      if (isModalOpen || isAuthOpen || isCatManagerOpen || isBackupModalOpen ||
          isImportModalOpen || isSettingsModalOpen || isSearchConfigModalOpen ||
          isEditMode || isBatchEditMode || isDragSortMode) {
        return;
      }

      if (!isSearchExpanded && !isMobileSearchOpen) {
        setIsSearchExpanded(true);
      }

      if (e.key !== 'Process') {
        setSearchQuery(prev => prev + e.key);
        e.preventDefault();
      }

      setTimeout(() => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.focus();
        }
      }, 0);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    init();
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [initData, unlockedCategoryIds]);

  // Apply dynamic website title and favicon
  useEffect(() => {
    if (aiConfig) {
      document.title = aiConfig.websiteTitle || '蜗牛个人导航';

      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = aiConfig.faviconUrl || '/favicon.ico';
    }
  }, [aiConfig?.websiteTitle, aiConfig?.faviconUrl]);

  // Close auth modal on login
  useEffect(() => {
    if (authToken) {
      setIsAuthOpen(false);
    }
  }, [authToken]);

  // Handle URL params for bookmarklet
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const addUrl = urlParams.get('add_url');
    if (addUrl) {
      const addTitle = urlParams.get('add_title') || '';
      window.history.replaceState({}, '', window.location.pathname);
      setPrefillLink({ title: addTitle, url: addUrl, categoryId: 'common' });
      setEditingLink(undefined);
      setIsModalOpen(true);
    }
  }, []);

  // --- Handlers ---
  const handleAddLink = useCallback(() => {
    setEditingLink(undefined);
    setPrefillLink(undefined);
    setIsModalOpen(true);
  }, []);

  const handleEditLink = useCallback((link: LinkItem) => {
    setEditingLink(link);
    setPrefillLink(undefined);
    setIsModalOpen(true);
  }, []);

  const handleDeleteLink = useCallback((id: string) => {
    if (confirm('确定删除此链接吗？')) {
      const linkToDelete = links.find(l => l.id === id);
      if (linkToDelete) {
        if (linkToDelete.edgeoneBlobUrl && linkToDelete.edgeoneBlobUrl.startsWith('/api/favicon?key=')) {
          try {
            const url = new URL(linkToDelete.edgeoneBlobUrl, window.location.origin);
            const key = url.searchParams.get('key');
            if (key) {
              fetch(`/api/upload?key=${encodeURIComponent(key)}&platform=edgeone`, {
                method: 'DELETE',
                headers: { 'x-auth-password': authToken || '' }
              }).catch(err => console.error('Failed to delete edgeone historical icon:', err));
            }
          } catch (e) {
            console.error(e);
          }
        }
        if (linkToDelete.cloudflareR2Url && linkToDelete.cloudflareR2Url.startsWith('/api/favicon?key=')) {
          try {
            const url = new URL(linkToDelete.cloudflareR2Url, window.location.origin);
            const key = url.searchParams.get('key');
            if (key) {
              fetch(`/api/upload?key=${encodeURIComponent(key)}&platform=cloudflare`, {
                method: 'DELETE',
                headers: { 'x-auth-password': authToken || '' }
              }).catch(err => console.error('Failed to delete cloudflare historical icon:', err));
            }
          } catch (e) {
            console.error(e);
          }
        }
        if (linkToDelete.icon && linkToDelete.icon.startsWith('/api/favicon?key=') &&
            linkToDelete.icon !== linkToDelete.edgeoneBlobUrl &&
            linkToDelete.icon !== linkToDelete.cloudflareR2Url) {
          try {
            const url = new URL(linkToDelete.icon, window.location.origin);
            const key = url.searchParams.get('key');
            if (key) {
              const platform = linkToDelete.iconType === 'upload-cloudflare' ? 'cloudflare' : 'edgeone';
              fetch(`/api/upload?key=${encodeURIComponent(key)}&platform=${platform}`, {
                method: 'DELETE',
                headers: { 'x-auth-password': authToken || '' }
              }).catch(err => console.error('Failed to delete current icon:', err));
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
      const newLinks = links.filter(l => l.id !== id);
      setLinksAndSync(newLinks, categories);
    }
  }, [links, categories, setLinksAndSync, authToken]);

  const toggleLinkSelection = useCallback((id: string) => {
    setSelectedLinks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleBatchEditMode = useCallback(() => {
    setIsBatchEditMode(prev => !prev);
    setSelectedLinks(new Set());
  }, []);

  const handleSaveLink = useCallback((link: LinkItem) => {
    if (editingLink) {
      const updated = links.map(l => l.id === link.id ? link : l);
      setLinksAndSync(updated, categories);
    } else {
      setLinksAndSync([...links, link], categories);
    }
    setIsModalOpen(false);
    setEditingLink(undefined);
    setPrefillLink(undefined);
  }, [editingLink, links, categories, setLinksAndSync]);

  const handleContextMenu = useCallback((e: React.MouseEvent, link: LinkItem) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      link,
    });
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (confirm(`确定删除选中的 ${selectedLinks.size} 个链接吗？`)) {
      selectedLinks.forEach(id => {
        const l = links.find(link => link.id === id);
        if (l) {
          if (l.edgeoneBlobUrl && l.edgeoneBlobUrl.startsWith('/api/favicon?key=')) {
            try {
              const url = new URL(l.edgeoneBlobUrl, window.location.origin);
              const key = url.searchParams.get('key');
              if (key) {
                fetch(`/api/upload?key=${encodeURIComponent(key)}&platform=edgeone`, {
                  method: 'DELETE',
                  headers: { 'x-auth-password': authToken || '' }
                }).catch(err => console.error('Failed to delete edgeone historical icon during batch delete:', err));
              }
            } catch (e) {
              console.error(e);
            }
          }
          if (l.cloudflareR2Url && l.cloudflareR2Url.startsWith('/api/favicon?key=')) {
            try {
              const url = new URL(l.cloudflareR2Url, window.location.origin);
              const key = url.searchParams.get('key');
              if (key) {
                fetch(`/api/upload?key=${encodeURIComponent(key)}&platform=cloudflare`, {
                  method: 'DELETE',
                  headers: { 'x-auth-password': authToken || '' }
                }).catch(err => console.error('Failed to delete cloudflare historical icon during batch delete:', err));
              }
            } catch (e) {
              console.error(e);
            }
          }
          if (l.icon && l.icon.startsWith('/api/favicon?key=') &&
              l.icon !== l.edgeoneBlobUrl &&
              l.icon !== l.cloudflareR2Url) {
            try {
              const url = new URL(l.icon, window.location.origin);
              const key = url.searchParams.get('key');
              if (key) {
                const platform = l.iconType === 'upload-cloudflare' ? 'cloudflare' : 'edgeone';
                fetch(`/api/upload?key=${encodeURIComponent(key)}&platform=${platform}`, {
                  method: 'DELETE',
                  headers: { 'x-auth-password': authToken || '' }
                }).catch(err => console.error('Failed to delete current icon during batch delete:', err));
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
      });
      const newLinks = links.filter(l => !selectedLinks.has(l.id));
      setLinksAndSync(newLinks, categories);
      setSelectedLinks(new Set());
      setIsBatchEditMode(false);
    }
  }, [selectedLinks, links, categories, setLinksAndSync, authToken]);

  const handleWeightChange = useCallback((linkId: string, weight: number) => {
    const updated = links.map(l => l.id === linkId ? { ...l, weight } : l);
    setLinksAndSync(updated, categories);
  }, [links, categories, setLinksAndSync]);

  const toggleDragSortMode = useCallback(() => {
    setIsDragSortMode(prev => !prev);
  }, []);

  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  // 处理分类点击：如果分类有密码且未解锁，显示密码弹窗
  const handleUnlockCategory = useCallback((cat: Category) => {
    if (cat.hasPassword && !unlockedCategoryIds.has(cat.id)) {
      setCatAuthModalData(cat);
    } else {
      // 已解锁的分类，正常跳转
      document.getElementById(`cat-${cat.id}`)?.scrollIntoView();
    }
  }, [unlockedCategoryIds]);

  // 处理密码验证成功后的解锁
  const handleCategoryUnlock = useCallback((id: string) => {
    unlockCategory(id);
    setCatAuthModalData(null);
    // 解锁后重新加载数据，带上新的解锁分类
    const newUnlocked = new Set([...unlockedCategoryIds, id]);
    initData(newUnlocked);
  }, [unlockCategory, unlockedCategoryIds, initData]);

  // Loading state
  if (isInitialLoading) {
    return (
      <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-900 overflow-hidden text-slate-900 dark:text-slate-50">
        <aside className="hidden lg:flex w-48 xl:w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-col">
          <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-700">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-24 animate-pulse" />
          </div>
          <div className="flex-1 p-4 space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${50 + i * 10}%` }} />
              </div>
            ))}
          </div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 h-16 flex items-center px-4 lg:px-8">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-24 animate-pulse" />
            <div className="flex-1 max-w-lg mx-4">
              <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
              <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
            </div>
          </header>
          <ContentSkeleton viewMode="detailed" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-900 overflow-hidden text-slate-900 dark:text-slate-50">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeCategoryId={activeCategoryId}
        onOpenCatManager={() => setIsCatManagerOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        onUnlockCategory={handleUnlockCategory}
        dragOffset={dragOffset}
        isDragging={isDragging}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isInternal={isInternal}
          onInternalChange={setIsInternal}
          onSearch={handleSearch}
          onAddLink={handleAddLink}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenCatManager={() => setIsCatManagerOpen(true)}
          onOpenBackup={() => setIsBackupModalOpen(true)}
          onOpenImport={() => setIsImportModalOpen(true)}
          onOpenAuth={() => setIsAuthOpen(true)}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          isBatchEditMode={isBatchEditMode}
          onToggleBatchEditMode={toggleBatchEditMode}
          isMobileSearchOpen={isMobileSearchOpen}
          onToggleMobileSearch={() => setIsMobileSearchOpen(prev => !prev)}
          isSearchExpanded={isSearchExpanded}
          setIsSearchExpanded={setIsSearchExpanded}
          isDragSortMode={isDragSortMode}
          onToggleDragSortMode={toggleDragSortMode}
          isEditMode={isEditMode}
          onToggleEditMode={toggleEditMode}
          visitorEngineId={visitorEngineId}
          onVisitorEngineChange={setVisitorEngineId}
        />
        <MainContent
          searchQuery={searchQuery}
          searchResults={searchResults}
          isBatchEditMode={isBatchEditMode}
          selectedLinks={selectedLinks}
          onToggleSelection={toggleLinkSelection}
          onEditLink={handleEditLink}
          onDeleteLink={handleDeleteLink}
          onContextMenu={handleContextMenu}
          isDragSortMode={isDragSortMode}
          isEditMode={isEditMode}
          onWeightChange={handleWeightChange}
          isInternal={isInternal}
        />
      </div>
      <AuthModal
        isOpen={isAuthOpen}
        onLogin={login}
        onClose={() => setIsAuthOpen(false)}
      />
      <Suspense fallback={null}>
        {isModalOpen && (
          <LinkModal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined); }}
            onSave={handleSaveLink}
            onDelete={editingLink ? () => handleDeleteLink(editingLink.id) : undefined}
            categories={categories}
            initialData={editingLink || prefillLink as LinkItem}
            aiConfig={aiConfig}
            defaultCategoryId={undefined}
            iconConfig={iconConfig}
            supportsUpload={capabilities?.upload ?? true}
          />
        )}
        {isCatManagerOpen && (
          <CategoryManagerModal
            isOpen={isCatManagerOpen}
            onClose={() => setIsCatManagerOpen(false)}
            categories={categories}
            onUpdateCategories={(newCats) => setCategoriesAndSync(newCats, links)}
            onDeleteCategory={(id) => {
              const newCats = categories.filter(c => c.id !== id);
              setCategoriesAndSync(newCats, links);
            }}
          />
        )}
        {isBackupModalOpen && (
          <BackupModal
            isOpen={isBackupModalOpen}
            onClose={() => setIsBackupModalOpen(false)}
            links={links}
            categories={categories}
            onRestore={(newLinks, newCats) => setLinksAndSync(newLinks, newCats)}
            webDavConfig={webdav || { url: '', username: '', password: '', enabled: false }}
            onSaveWebDavConfig={setWebDav}
            searchConfig={search || { mode: 'internal', externalSources: [] }}
            onRestoreSearchConfig={setSearch}
            aiConfig={aiConfig}
            onRestoreAIConfig={setAI}
          />
        )}
        {isImportModalOpen && (
          <ImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            existingLinks={links}
            categories={categories}
            onImport={(newLinks, newCats) => setLinksAndSync(newLinks, newCats)}
          />
        )}
        {isSettingsModalOpen && (
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            authToken={authToken}
            onSettingsLoaded={(settings) => {
              setAI(settings.ai);
              setWebsite({ ...website, passwordExpiry: settings.passwordExpiry });
              setMastodon(settings.ticker);
              setWeather(settings.weather);
              setShowPinned(settings.showPinnedWebsites);
              if (settings.defaultViewMode) {
                setViewMode(settings.defaultViewMode);
              }
            }}
          />
        )}
        {isSearchConfigModalOpen && (
          <SearchConfigModal
            isOpen={isSearchConfigModalOpen}
            onClose={() => setIsSearchConfigModalOpen(false)}
          />
        )}
        {contextMenu.isOpen && contextMenu.link && (
          <ContextMenu
            isOpen={contextMenu.isOpen}
            position={contextMenu.position}
            link={contextMenu.link}
            onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
            onCopyLink={() => {
              navigator.clipboard.writeText(contextMenu.link!.url);
              setContextMenu(prev => ({ ...prev, isOpen: false }));
            }}
            onShowQRCode={(url, title) => {
              setQrCodeModal({ isOpen: true, url, title });
              setContextMenu(prev => ({ ...prev, isOpen: false }));
            }}
            onEdit={() => {
              setEditingLink(contextMenu.link!);
              setIsModalOpen(true);
              setContextMenu(prev => ({ ...prev, isOpen: false }));
            }}
            onDelete={() => {
              handleDeleteLink(contextMenu.link!.id);
              setContextMenu(prev => ({ ...prev, isOpen: false }));
            }}
            onTogglePin={() => {
              const updated = links.map(l =>
                l.id === contextMenu.link!.id ? { ...l, isPinned: !l.isPinned } : l
              );
              setLinksAndSync(updated, categories);
              setContextMenu(prev => ({ ...prev, isOpen: false }));
            }}
          />
        )}
        {qrCodeModal.isOpen && (
          <QRCodeModal
            isOpen={qrCodeModal.isOpen}
            url={qrCodeModal.url}
            title={qrCodeModal.title}
            onClose={() => setQrCodeModal({ isOpen: false, url: '', title: '' })}
          />
        )}
      </Suspense>
      {catAuthModalData && (
        <CategoryAuthModal
          isOpen={!!catAuthModalData}
          category={catAuthModalData}
          onClose={() => setCatAuthModalData(null)}
          onUnlock={handleCategoryUnlock}
        />
      )}
            {isBatchEditMode && selectedLinks.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-800/95 border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between shadow-lg">
          <span className="text-sm text-slate-600 dark:text-slate-300">
            已选中 <span className="font-bold text-blue-600 dark:text-blue-400">{selectedLinks.size}</span> 个链接
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedLinks(new Set()); setIsBatchEditMode(false); }}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              删除选中
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
