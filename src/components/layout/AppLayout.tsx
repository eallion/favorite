import React, { useState, useEffect, Suspense, lazy, useCallback, useRef } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import { useLinksContext } from '../../contexts/LinksContext';
import { useCategoriesContext } from '../../contexts/CategoriesContext';
import { useConfigContext } from '../../contexts/ConfigContext';
import { useSearch } from '../../hooks/useSearch';
import { useDataSync } from '../../hooks/useDataSync';
import { toast } from '../../../components/Toast';
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
  const { authToken, requiresAuth, isCheckingAuth, capabilities, login, logout } = useAuthContext();
  const { links = [], addLink, updateLink, deleteLink, deleteLinks, setLinksAndSync } = useLinksContext();
  const { categories = [], categoryTree = [], setCategoriesAndSync, unlockedCategoryIds, unlockCategory } = useCategoriesContext();
  const { ai: aiConfig, icon: iconConfig, viewMode, showPinnedWebsites, ticker, weather, website, webdav, search, setAI, setIcon, setWebsite, setShowPinned, setMastodon, setWeather, setWebDav, setSearch, setViewMode } = useConfigContext();

  const {
    searchQuery, setSearchQuery, searchResults, isMobileSearchOpen, setIsMobileSearchOpen,
    isSearchExpanded, setIsSearchExpanded,
    isInternal, setIsInternal, handleSearch, visitorEngineId, setVisitorEngineId
  } = useSearch();
  const { initData } = useDataSync();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const [isDragSortMode, setIsDragSortMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSearchConfigModalOpen, setIsSearchConfigModalOpen] = useState(false);
  const [catAuthModalData, setCatAuthModalData] = useState<Category | null>(null);

  const [editingLink, setEditingLink] = useState<LinkItem | undefined>(undefined);
  const [prefillLink, setPrefillLink] = useState<Partial<LinkItem> | undefined>(undefined);

  const [isBatchEditMode, setIsBatchEditMode] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    link: LinkItem | null;
  }>({ isOpen: false, position: { x: 0, y: 0 }, link: null });

  const [qrCodeModal, setQrCodeModal] = useState<{
    isOpen: boolean; url: string; title: string;
  }>({ isOpen: false, url: '', title: '' });

  const [pendingDragLinks, setPendingDragLinks] = useState<{ links: LinkItem[]; categories: Category[] } | null>(null);

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({
    startX: 0, startY: 0, currentX: 0, startTime: 0, sidebarWasOpen: false, isActive: false,
  });
  const SIDEBAR_WIDTH = 256;
  const EDGE_THRESHOLD = 30;
  const OPEN_THRESHOLD = 80;
  const CLOSE_THRESHOLD = 80;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const isEdge = touch.clientX < EDGE_THRESHOLD;
    const isInSidebar = sidebarOpen && touch.clientX < SIDEBAR_WIDTH;
    if (!isEdge && !isInSidebar) return;
    dragState.current = {
      startX: touch.clientX, startY: touch.clientY, currentX: touch.clientX,
      startTime: Date.now(), sidebarWasOpen: sidebarOpen, isActive: true,
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
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      state.isActive = false; setIsDragging(false); setDragOffset(0); return;
    }
    if (Math.abs(deltaX) < 5) return;
    state.currentX = touch.clientX;
    if (state.sidebarWasOpen) {
      setDragOffset(Math.max(-SIDEBAR_WIDTH, Math.min(0, deltaX)));
    } else {
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
      if (deltaX < -CLOSE_THRESHOLD || (deltaX < -20 && velocity > 0.5)) setSidebarOpen(false);
    } else {
      if (deltaX > OPEN_THRESHOLD || (deltaX > 20 && velocity > 0.5)) setSidebarOpen(true);
    }
    setDragOffset(0);
  }, []);

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

  useEffect(() => {
    const init = async () => {
      await initData(unlockedCategoryIds);
      setIsInitialLoading(false);
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || (activeElement as HTMLElement)?.isContentEditable;
      if (isInput) return;
      if (e.key === 'Escape') {
        if (isSearchExpanded) { setIsSearchExpanded(false); setSearchQuery(''); document.getElementById('search-input')?.blur(); }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1 && e.key !== 'Process') return;
      if (isModalOpen || isAuthOpen || isCatManagerOpen || isBackupModalOpen || isImportModalOpen || isSettingsModalOpen || isSearchConfigModalOpen || isEditMode || isBatchEditMode || isDragSortMode) return;
      if (!isSearchExpanded && !isMobileSearchOpen) setIsSearchExpanded(true);
      if (e.key !== 'Process') { setSearchQuery(prev => prev + e.key); e.preventDefault(); }
      setTimeout(() => document.getElementById('search-input')?.focus(), 0);
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    init();
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [initData, unlockedCategoryIds]);

  useEffect(() => {
    if (aiConfig) {
      document.title = aiConfig.websiteTitle || '蜗牛个人导航';
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = aiConfig.faviconUrl || '/favicon.ico';
    }
  }, [aiConfig?.websiteTitle, aiConfig?.faviconUrl]);

  useEffect(() => { if (authToken) setIsAuthOpen(false); }, [authToken]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const addUrl = urlParams.get('add_url');
    if (addUrl) {
      window.history.replaceState({}, '', window.location.pathname);
      setPrefillLink({ title: urlParams.get('add_title') || '', url: addUrl, categoryId: 'common' });
      setEditingLink(undefined);
      setIsModalOpen(true);
    }
  }, []);

  const handleAddLink = useCallback(() => {
    setEditingLink(undefined); setPrefillLink(undefined); setIsModalOpen(true);
  }, []);

  const handleEditLink = useCallback((link: LinkItem) => {
    setEditingLink(link); setPrefillLink(undefined); setIsModalOpen(true);
  }, []);

  const handleDeleteLink = useCallback((id: string) => {
    if (!confirm('确定删除此链接吗？')) return;
    const linkToDelete = links.find(l => l.id === id);
    if (linkToDelete) {
      // Cleanup icon storage...
      if (linkToDelete.edgeoneBlobUrl?.startsWith('/api/favicon?key=')) {
        try { const u = new URL(linkToDelete.edgeoneBlobUrl, window.location.origin); const key = u.searchParams.get('key');
          if (key) fetch(`/api/upload?key=${encodeURIComponent(key)}&platform=edgeone`, { method: 'DELETE', headers: { 'x-auth-password': authToken || '' } }).catch(()=>{});
        } catch(e){}
      }
      if (linkToDelete.cloudflareR2Url?.startsWith('/api/favicon?key=')) {
        try { const u = new URL(linkToDelete.cloudflareR2Url, window.location.origin); const key = u.searchParams.get('key');
          if (key) fetch(`/api/upload?key=${encodeURIComponent(key)}&platform=cloudflare`, { method: 'DELETE', headers: { 'x-auth-password': authToken || '' } }).catch(()=>{});
        } catch(e){}
      }
    }
    const deletedTitle = linkToDelete?.title || '书签';
    const newLinks = links.filter(l => l.id !== id);
    setLinksAndSync(newLinks, categories);
    toast.success(`「${deletedTitle}」已删除`);
  }, [links, categories, setLinksAndSync, authToken]);

  const toggleLinkSelection = useCallback((id: string) => {
    setSelectedLinks(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const toggleBatchEditMode = useCallback(() => {
    setIsBatchEditMode(prev => !prev); setSelectedLinks(new Set());
  }, []);

  // ===== 修复：确保保存时 id 有效，且使用最新的 links 状态 =====
  const handleSaveLink = useCallback((link: LinkItem) => {
    // 确保 id 有效，如果无效则生成新 id
    const validLink = {
      ...link,
      id: link.id && link.id.trim() !== '' ? link.id : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    };

    if (editingLink) {
      // 编辑现有链接：使用函数式更新避免 stale closure
      setLinksAndSync(
        links.map(l => l.id === validLink.id ? validLink : l),
        categories
      );
      toast.success(`已更新「${validLink.title}」`);
    } else {
      // 新建链接
      setLinksAndSync([...links, validLink], categories);
      toast.success(`已添加「${validLink.title}」`);
    }
    setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined);
  }, [editingLink, links, categories, setLinksAndSync]);

  const handleContextMenu = useCallback((e: React.MouseEvent, link: LinkItem) => {
    if (isBatchEditMode || !authToken) return;
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, link });
  }, [isBatchEditMode, authToken]);

  const handleBatchDelete = useCallback(() => {
    if (!confirm(`确定删除选中的 ${selectedLinks.size} 个链接吗？`)) return;
    const newLinks = links.filter(l => !selectedLinks.has(l.id));
    setLinksAndSync(newLinks, categories);
    setSelectedLinks(new Set()); setIsBatchEditMode(false);
    toast.success(`已批量删除 ${selectedLinks.size} 个书签`);
  }, [selectedLinks, links, categories, setLinksAndSync]);

  const handleWeightChange = useCallback((linkId: string, weight: number) => {
    const updated = links.map(l => l.id === linkId ? { ...l, weight } : l);
    setLinksAndSync(updated, categories);
  }, [links, categories, setLinksAndSync]);

  const toggleDragSortMode = useCallback(() => setIsDragSortMode(prev => !prev), []);
  const toggleEditMode = useCallback(() => setIsEditMode(prev => !prev), []);

  const handleUnlockCategory = useCallback((cat: Category) => {
    if (cat.hasPassword && !unlockedCategoryIds.has(cat.id)) setCatAuthModalData(cat);
    else document.getElementById(`cat-${cat.id}`)?.scrollIntoView();
  }, [unlockedCategoryIds]);

  const handleCategoryUnlock = useCallback((id: string) => {
    unlockCategory(id); setCatAuthModalData(null);
    const newUnlocked = new Set([...unlockedCategoryIds, id]);
    initData(newUnlocked);
  }, [unlockCategory, unlockedCategoryIds, initData]);

  if (isInitialLoading) {
    return (
      <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-900 overflow-hidden text-slate-900 dark:text-slate-50">
        <aside className="hidden lg:flex w-48 xl:w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-col">
          <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-700">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-24 animate-pulse" />
          </div>
          <div className="flex-1 p-4 space-y-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${50+i*10}%` }} />
              </div>
            ))}
          </div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 h-16 flex items-center px-4 lg:px-8">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-24 animate-pulse" />
            <div className="flex-1 max-w-lg mx-4"><div className="h-9 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" /></div>
            <div className="flex gap-2"><div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" /><div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" /></div>
          </header>
          <ContentSkeleton viewMode="detailed" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-900 overflow-hidden text-slate-900 dark:text-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} activeCategoryId={activeCategoryId} onOpenCatManager={() => setIsCatManagerOpen(true)} onOpenBackup={() => setIsBackupModalOpen(true)} onUnlockCategory={handleUnlockCategory} dragOffset={dragOffset} isDragging={isDragging} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} isInternal={isInternal} onInternalChange={setIsInternal} onSearch={handleSearch} onAddLink={handleAddLink} onOpenSettings={() => setIsSettingsModalOpen(true)} onOpenCatManager={() => setIsCatManagerOpen(true)} onOpenBackup={() => setIsBackupModalOpen(true)} onOpenImport={() => setIsImportModalOpen(true)} onOpenAuth={() => setIsAuthOpen(true)} onToggleSidebar={() => setSidebarOpen(prev => !prev)} isBatchEditMode={isBatchEditMode} onToggleBatchEditMode={toggleBatchEditMode} isMobileSearchOpen={isMobileSearchOpen} onToggleMobileSearch={() => setIsMobileSearchOpen(prev => !prev)} isSearchExpanded={isSearchExpanded} setIsSearchExpanded={setIsSearchExpanded} isDragSortMode={isDragSortMode} onToggleDragSortMode={toggleDragSortMode} isEditMode={isEditMode} onToggleEditMode={toggleEditMode} visitorEngineId={visitorEngineId} onVisitorEngineChange={setVisitorEngineId} />
        <MainContent searchQuery={searchQuery} searchResults={searchResults} isBatchEditMode={isBatchEditMode} selectedLinks={selectedLinks} onToggleSelection={toggleLinkSelection} onEditLink={handleEditLink} onDeleteLink={handleDeleteLink} onContextMenu={handleContextMenu} isDragSortMode={isDragSortMode} isEditMode={isEditMode} onWeightChange={handleWeightChange} isInternal={isInternal} />
      </div>
      <AuthModal isOpen={isAuthOpen} onLogin={login} onClose={() => setIsAuthOpen(false)} />
      <Suspense fallback={null}>
        {isModalOpen && <LinkModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined); }} onSave={handleSaveLink} onDelete={editingLink ? () => handleDeleteLink(editingLink.id) : undefined} categories={categories} initialData={editingLink || prefillLink as LinkItem} aiConfig={aiConfig} defaultCategoryId={undefined} iconConfig={iconConfig} supportsUpload={capabilities?.upload ?? true} />}
        {isCatManagerOpen && <CategoryManagerModal isOpen={isCatManagerOpen} onClose={() => setIsCatManagerOpen(false)} categories={categories} links={links} onUpdateCategories={(newCats) => setCategoriesAndSync(newCats, links)} onDeleteCategory={(id) => { const newCats = categories.filter(c => c.id !== id); setCategoriesAndSync(newCats, links); }} onUpdateLinks={(newLinks) => setLinksAndSync(newLinks, categories)} />}
        {isBackupModalOpen && <BackupModal isOpen={isBackupModalOpen} onClose={() => setIsBackupModalOpen(false)} links={links} categories={categories} onRestore={(newLinks, newCats) => setLinksAndSync(newLinks, newCats)} webDavConfig={webdav || { url: '', username: '', password: '', enabled: false }} onSaveWebDavConfig={setWebDav} searchConfig={search || { mode: 'internal', externalSources: [] }} onRestoreSearchConfig={setSearch} aiConfig={aiConfig} onRestoreAIConfig={setAI} />}
        {isImportModalOpen && <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} existingLinks={links} categories={categories} onImport={(newLinks, newCats) => setLinksAndSync(newLinks, newCats)} />}
        {isSettingsModalOpen && <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} authToken={authToken} onSettingsLoaded={(settings) => { setAI(settings.ai); setWebsite({ ...website, passwordExpiry: settings.passwordExpiry }); setMastodon(settings.ticker); setWeather(settings.weather); setShowPinned(settings.showPinnedWebsites); if (settings.defaultViewMode) setViewMode(settings.defaultViewMode); }} />}
        {isSearchConfigModalOpen && <SearchConfigModal isOpen={isSearchConfigModalOpen} onClose={() => setIsSearchConfigModalOpen(false)} />}
        {contextMenu.isOpen && contextMenu.link && (
          <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} link={contextMenu.link} onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))} onCopyLink={() => { navigator.clipboard.writeText(contextMenu.link!.url); setContextMenu(prev => ({ ...prev, isOpen: false })); }} onShowQRCode={(url, title) => { setQrCodeModal({ isOpen: true, url, title }); setContextMenu(prev => ({ ...prev, isOpen: false })); }} onEdit={() => { setEditingLink(contextMenu.link!); setIsModalOpen(true); setContextMenu(prev => ({ ...prev, isOpen: false })); }} onDelete={() => { handleDeleteLink(contextMenu.link!.id); setContextMenu(prev => ({ ...prev, isOpen: false })); }} onTogglePin={() => {
            const targetLink = contextMenu.link!;
            const newPinned = !targetLink.pinned;
            setLinksAndSync(
              links.map(l => l.id === targetLink.id ? { ...l, pinned: newPinned } : l),
              categories
            );
            setContextMenu(prev => ({ ...prev, isOpen: false }));
            toast.success(newPinned ? `「${targetLink.title}」已置顶` : `「${targetLink.title}」已取消置顶`);
          }} />
        )}
        {qrCodeModal.isOpen && <QRCodeModal isOpen={qrCodeModal.isOpen} url={qrCodeModal.url} title={qrCodeModal.title} onClose={() => setQrCodeModal({ isOpen: false, url: '', title: '' })} />}
      </Suspense>
      {catAuthModalData && <CategoryAuthModal isOpen={!!catAuthModalData} category={catAuthModalData} onClose={() => setCatAuthModalData(null)} onUnlock={handleCategoryUnlock} />}
      {isBatchEditMode && selectedLinks.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-800/95 border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between shadow-lg">
          <span className="text-sm text-slate-600 dark:text-slate-300">已选中 <span className="font-bold text-blue-600 dark:text-blue-400">{selectedLinks.size}</span> 个链接</span>
          <div className="flex items-center gap-2">
            <button onClick={() => { setSelectedLinks(new Set()); setIsBatchEditMode(false); }} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">取消</button>
            <button onClick={handleBatchDelete} className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">删除选中</button>
          </div>
        </div>
      )}
    </div>
  );
}
