import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
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
  const { categories = [], categoryTree = [], setCategoriesAndSync, unlockedCategoryIds = new Set(), unlockCategory } = useCategoriesContext();
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

  // Initialize data
  useEffect(() => {
    const init = async () => {
      await initData();
      setIsInitialLoading(false);
    };

    // Global keyboard listener for search focus
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is already typing in an input/textarea
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || 
                     activeElement?.tagName === 'TEXTAREA' || 
                     (activeElement as HTMLElement)?.isContentEditable;
      
      if (isInput) return;

      // Global Escape handler to close and clear search
      if (e.key === 'Escape') {
        if (isSearchExpanded) {
          setIsSearchExpanded(false);
          setSearchQuery('');
          document.getElementById('search-input')?.blur();
        }
        return;
      }

      // Ignore modifier keys and special keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1 && e.key !== 'Process') return; // 'Process' is for IME

      // Don't trigger if any modal is open or in edit modes
      if (isModalOpen || isAuthOpen || isCatManagerOpen || isBackupModalOpen || 
          isImportModalOpen || isSettingsModalOpen || isSearchConfigModalOpen ||
          isEditMode || isBatchEditMode || isDragSortMode) {
        return;
      }

      // Open search if collapsed
      if (!isSearchExpanded && !isMobileSearchOpen) {
        setIsSearchExpanded(true);
      }

      // If it's a normal English character, the browser's keypress event is usually swallowed
      // because the focus is moving from the body to the input. We must manually capture it.
      if (e.key !== 'Process') {
        setSearchQuery(prev => prev + e.key);
        e.preventDefault(); // Prevent double insertion just in case
      }

      // Delay micro-seconds to focus, allowing the character to naturally fall into the input box to wake up the IME
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
  }, [initData]);

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
        // 1. 清理 EdgeOne Blob 历史图标
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
        // 2. 清理 Cloudflare R2 历史图标
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
        // 3. 兼容旧版本数据或当前选中的图标（如果没有被前面的历史记录覆盖）
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
      deleteLink(id);
      setLinksAndSync(links.filter(l => l.id !== id), categories);
    }
  }, [deleteLink, links, categories, setLinksAndSync, authToken]);

  const handleSaveLink = useCallback((data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (editingLink) {
      const updated = links.map(l => l.id === editingLink.id ? { ...l, ...data } : l);
      setLinksAndSync(updated, categories);
    } else {
      const newLink: LinkItem = {
        ...data,
        id: Date.now().toString(),
        createdAt: Date.now(),
      };
      setLinksAndSync([newLink, ...links], categories);
    }
    setIsModalOpen(false);
    setEditingLink(undefined);
    setPrefillLink(undefined);
  }, [editingLink, links, categories, setLinksAndSync, authToken]);

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, link: LinkItem) => {
    if (isBatchEditMode || !authToken) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, link });
  }, [isBatchEditMode, authToken]);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, link: null });
  }, []);

  const deleteLinkFromContextMenu = useCallback(() => {
    if (!contextMenu.link) return;
    if (confirm(`确定要删除"${contextMenu.link.title}"吗？`)) {
      handleDeleteLink(contextMenu.link.id);
    }
    closeContextMenu();
  }, [contextMenu.link, handleDeleteLink, closeContextMenu]);

  const editLinkFromContextMenu = useCallback(() => {
    if (!contextMenu.link) return;
    handleEditLink(contextMenu.link);
    closeContextMenu();
  }, [contextMenu.link, handleEditLink, closeContextMenu]);

  const togglePinFromContextMenu = useCallback(() => {
    if (!contextMenu.link) return;
    const updated = links.map(l => {
      if (l.id === contextMenu.link!.id) {
        const isPinned = !l.pinned;
        return { ...l, pinned: isPinned, pinnedOrder: isPinned ? links.filter(link => link.pinned).length : undefined };
      }
      return l;
    });
    setLinksAndSync(updated, categories);
    closeContextMenu();
  }, [contextMenu.link, links, categories, setLinksAndSync, closeContextMenu]);

  // Batch edit handlers
  const toggleBatchEditMode = useCallback(() => {
    setIsBatchEditMode(prev => !prev);
    setSelectedLinks(new Set());
  }, []);

  const toggleLinkSelection = useCallback((linkId: string) => {
    setSelectedLinks(prev => {
      const next = new Set(prev);
      if (next.has(linkId)) next.delete(linkId);
      else next.add(linkId);
      return next;
    });
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (selectedLinks.size === 0) return;
    if (confirm(`确定要删除选中的 ${selectedLinks.size} 个链接吗？`)) {
      // 批量删除关联的自定义及历史图标
      links.forEach(l => {
        if (selectedLinks.has(l.id)) {
          // 1. 清理 EdgeOne Blob 历史图标
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
          // 2. 清理 Cloudflare R2 历史图标
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
          // 3. 兼容旧版本数据或当前图标
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

  // Weight change handler
  const handleWeightChange = useCallback((linkId: string, weight: number) => {
    const updated = links.map(l => l.id === linkId ? { ...l, weight } : l);
    setLinksAndSync(updated, categories);
  }, [links, categories, setLinksAndSync]);

  // Toggle handlers
  const toggleDragSortMode = useCallback(() => {
    setIsDragSortMode(prev => !prev);
  }, []);

  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  // Loading state
  if (isInitialLoading) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden text-slate-900 dark:text-slate-50">
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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden text-slate-900 dark:text-slate-50">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeCategoryId={activeCategoryId}
        onOpenCatManager={() => setIsCatManagerOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        onUnlockCategory={(cat) => {
          setCatAuthModalData(cat);
          setSidebarOpen(false);
        }}
      />

      {/* Main area */}
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

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onLogin={login}
        onClose={() => setIsAuthOpen(false)}
      />

      {/* Other Modals */}
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
              if (settings.icon) {
                setIcon(settings.icon);
              }
            }}
            onImportClick={() => { setIsImportModalOpen(true); setIsSettingsModalOpen(false); }}
            onBackupClick={() => { setIsBackupModalOpen(true); setIsSettingsModalOpen(false); }}
            supportsUpload={capabilities?.upload ?? true}
          />
        )}

        {isSearchConfigModalOpen && (
          <SearchConfigModal
            isOpen={isSearchConfigModalOpen}
            onClose={() => setIsSearchConfigModalOpen(false)}
          />
        )}

        {catAuthModalData && (
          <CategoryAuthModal
            isOpen={true}
            category={catAuthModalData}
            onClose={() => setCatAuthModalData(null)}
            onUnlock={(id) => { unlockCategory(id); setCatAuthModalData(null); }}
          />
        )}

        {contextMenu.isOpen && (
          <ContextMenu
            isOpen={contextMenu.isOpen}
            position={contextMenu.position}
            link={contextMenu.link}
            onClose={closeContextMenu}
            onEdit={editLinkFromContextMenu}
            onDelete={deleteLinkFromContextMenu}
            onTogglePin={togglePinFromContextMenu}
            onShowQRCode={(url, title) => {
              setQrCodeModal({ isOpen: true, url, title });
              closeContextMenu();
            }}
            onCopyLink={() => {
              if (contextMenu.link) {
                navigator.clipboard.writeText(contextMenu.link.url);
              }
              closeContextMenu();
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
    </div>
  );
}
