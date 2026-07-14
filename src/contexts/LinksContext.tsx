import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { LinkItem, Category } from '../../types';
import { STORAGE_KEYS, API_ENDPOINTS } from '../constants';
import { useAuthContext } from './AuthContext';

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

  const initLinks = useCallback((links: LinkItem[]) => {
    dispatch({ type: 'SET_LINKS', payload: links });
  }, []);

  const addLink = useCallback((data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    const newLink: LinkItem = {
      ...data,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    dispatch({ type: 'ADD_LINK', payload: newLink });
  }, []);

  const updateLink = useCallback((link: LinkItem) => {
    dispatch({ type: 'UPDATE_LINK', payload: link });
  }, []);

  const deleteLink = useCallback((id: string) => {
    dispatch({ type: 'DELETE_LINK', payload: id });
  }, []);

  const deleteLinks = useCallback((ids: Set<string>) => {
    dispatch({ type: 'DELETE_LINKS', payload: ids });
  }, []);

  const updateLinks = useCallback((links: LinkItem[]) => {
    dispatch({ type: 'SET_LINKS', payload: links });
  }, []);

  const setLinksAndSync = useCallback((links: LinkItem[], categories: Category[]) => {
    dispatch({ type: 'SET_LINKS', payload: links });
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_KEY, JSON.stringify({ links, categories }));
    if (authToken) {
      fetch(API_ENDPOINTS.STORAGE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authToken,
        },
        body: JSON.stringify({ links, categories }),
      }).catch(e => console.error('Sync links failed:', e));
    }
  }, [authToken]);

  // 过滤私人书签：未登录时隐藏
  const visibleLinks = useMemo(() => {
    if (authToken) return state.links;
    return state.links.filter(link => !link.isPrivate);
  }, [state.links, authToken]);

  const pinnedLinks = useMemo(() => {
    const pinned = visibleLinks.filter(l => l.pinned);
    return [...pinned].sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0));
  }, [visibleLinks]);

  const getLinksByCategory = useCallback((categoryId: string) => {
    return visibleLinks.filter(l => l.categoryId === categoryId);
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
