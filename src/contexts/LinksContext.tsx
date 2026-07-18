import React, { createContext, useContext, useReducer, useCallback, useMemo, useRef } from 'react';
import { LinkItem, Category } from '../../types';
import { STORAGE_KEYS, API_ENDPOINTS } from '../constants';
import { useAuthContext } from './AuthContext';
import { toast } from '../../components/Toast';

// --- Types ---
interface LinksState {
  links: LinkItem[];
  syncStatus: 'idle' | 'saving' | 'saved' | 'error';
}

type LinksAction =
  | { type: 'SET_LINKS'; payload: LinkItem[] }
  | { type: 'ADD_LINK'; payload: LinkItem }
  | { type: 'UPDATE_LINK'; payload: LinkItem }
  | { type: 'DELETE_LINK'; payload: string }
  | { type: 'DELETE_LINKS'; payload: Set<string> }
  | { type: 'SET_SYNC_STATUS'; payload: LinksState['syncStatus'] };

interface LinksContextValue extends LinksState {
  initLinks: (links: LinkItem[]) => void;
  addLink: (data: Omit<LinkItem, 'id' | 'createdAt'>) => void;
  updateLink: (link: LinkItem) => void;
  deleteLink: (id: string) => void;
  deleteLinks: (ids: Set<string>) => void;
  updateLinks: (links: LinkItem[]) => void;
  setLinksAndSync: (links: LinkItem[], categories: Category[]) => void;
  pinnedLinks: LinkItem[];
  getLinksByCategory: (categoryId: string) => LinkItem[];
}

// --- Reducer ---
function linksReducer(state: LinksState, action: LinksAction): LinksState {
  switch (action.type) {
    case 'SET_LINKS':
      return { ...state, links: action.payload };
    case 'ADD_LINK':
      return { ...state, links: [action.payload, ...state.links] };
    case 'UPDATE_LINK':
      return { ...state, links: state.links.map(l => l.id === action.payload.id ? action.payload : l) };
    case 'DELETE_LINK':
      return { ...state, links: state.links.filter(l => l.id !== action.payload) };
    case 'DELETE_LINKS':
      return { ...state, links: state.links.filter(l => !action.payload.has(l.id)) };
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload };
    default:
      return state;
  }
}

// --- Context ---
const LinksContext = createContext<LinksContextValue | null>(null);

// --- Provider ---
export function LinksProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(linksReducer, {
    links: [],
    syncStatus: 'idle',
  });

  const { authToken } = useAuthContext();

  // 防抖定时器 ref
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSyncRef = useRef<{ links: LinkItem[]; categories: Category[] } | null>(null);

  const initLinks = useCallback((links: LinkItem[]) => {
    dispatch({ type: 'SET_LINKS', payload: links });
  }, []);

  const addLink = useCallback((data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    const newLink: LinkItem = {
      ...data,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      createdAt: Date.now(),
    };
    dispatch({ type: 'ADD_LINK', payload: newLink });
    toast.success(`已添加书签「${data.title}」`);
  }, []);

  const updateLink = useCallback((link: LinkItem) => {
    dispatch({ type: 'UPDATE_LINK', payload: link });
    toast.success(`已更新书签「${link.title}」`);
  }, []);

  const deleteLink = useCallback((id: string) => {
    dispatch({ type: 'DELETE_LINK', payload: id });
    toast.success('书签已删除');
  }, []);

  const deleteLinks = useCallback((ids: Set<string>) => {
    dispatch({ type: 'DELETE_LINKS', payload: ids });
    toast.success(`已删除 ${ids.size} 个书签`);
  }, []);

  const updateLinks = useCallback((links: LinkItem[]) => {
    dispatch({ type: 'SET_LINKS', payload: links });
  }, []);

  // 防抖同步到云端：500ms 内多次修改只发一次请求
  const setLinksAndSync = useCallback((links: LinkItem[], categories: Category[]) => {
    // 过滤掉无效链接（没有 id 的）
    const validLinks = links.filter(l => l.id && l.id.trim() !== '');

    dispatch({ type: 'SET_LINKS', payload: validLinks });
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_KEY, JSON.stringify({ links: validLinks, categories }));

    if (!authToken) return;

    // 保存待同步数据
    pendingSyncRef.current = { links: validLinks, categories };

    // 清除旧的定时器
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    dispatch({ type: 'SET_SYNC_STATUS', payload: 'saving' });

    // 500ms 防抖后执行同步
    syncTimeoutRef.current = setTimeout(() => {
      const pending = pendingSyncRef.current;
      if (!pending) return;

      fetch(API_ENDPOINTS.STORAGE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authToken,
        },
        body: JSON.stringify(pending),
      })
      .then(() => {
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'saved' });
        toast.success('数据已同步到云端');
        setTimeout(() => {
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
        }, 2000);
      })
      .catch(e => {
        console.error('Sync links failed:', e);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
        toast.error('同步失败，请检查网络');
      });

      pendingSyncRef.current = null;
    }, 500);
  }, [authToken]);

  // 过滤私人书签：未登录时隐藏
  const visibleLinks = useMemo(() => {
    if (authToken) return state.links;
    return state.links.filter(link => !link.isPrivate);
  }, [state.links, authToken]);

  const pinnedLinks = useMemo(() => {
    const pinned = visibleLinks.filter(l => l.pinned);
    return [...pinned].sort((a, b) => {
      const weightDiff = (b.weight ?? 0) - (a.weight ?? 0);
      if (weightDiff !== 0) return weightDiff;
      return (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0);
    });
  }, [visibleLinks]);

  const getLinksByCategory = useCallback((categoryId: string) => {
    return visibleLinks
      .filter(l => l.categoryId === categoryId)
      .sort((a, b) => {
        const weightDiff = (b.weight ?? 0) - (a.weight ?? 0);
        if (weightDiff !== 0) return weightDiff;
        return (a.order ?? 0) - (b.order ?? 0);
      });
  }, [visibleLinks]);

  return (
    <LinksContext.Provider value={{
      ...state,
      initLinks,
      addLink, updateLink, deleteLink, deleteLinks, updateLinks,
      setLinksAndSync,
      pinnedLinks,
      getLinksByCategory,
    }}>
      {children}
    </LinksContext.Provider>
  );
}

// --- Hook ---
export function useLinksContext() {
  const ctx = useContext(LinksContext);
  if (!ctx) throw new Error('useLinksContext must be used within LinksProvider');
  return ctx;
}
