import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { Category, LinkItem, DEFAULT_CATEGORIES } from '../../types';
import { STORAGE_KEYS, API_ENDPOINTS } from '../constants';
import { useAuthContext } from './AuthContext';

// --- Types ---
interface CategoriesState {
  categories: Category[];
  unlockedCategoryIds: Set<string>;
  expandedCategories: Set<string>;
}

type CategoriesAction =
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'ADD_CATEGORY'; payload: Category }
  | { type: 'UPDATE_CATEGORY'; payload: Category }
  | { type: 'DELETE_CATEGORY'; payload: string }
  | { type: 'UNLOCK_CATEGORY'; payload: string }
  | { type: 'TOGGLE_EXPAND'; payload: string }
  | { type: 'SET_EXPANDED'; payload: Set<string> };

interface CategoriesContextValue extends CategoriesState {
  initCategories: (categories: Category[]) => void;
  addCategory: (cat: Category) => void;
  updateCategory: (cat: Category) => void;
  deleteCategory: (id: string) => void;
  unlockCategory: (id: string) => void;
  toggleExpand: (id: string) => void;
  setCategoriesAndSync: (categories: Category[], links: LinkItem[]) => void;
  categoryTree: CategoryWithChildren[];
  buildCategoryTree: (cats: Category[]) => CategoryWithChildren[];
}

export interface CategoryWithChildren extends Category {
  children: Category[];
}

// --- Reducer ---
function categoriesReducer(state: CategoriesState, action: CategoriesAction): CategoriesState {
  switch (action.type) {
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, action.payload] };
    case 'UPDATE_CATEGORY':
      return { ...state, categories: state.categories.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_CATEGORY':
      return { ...state, categories: state.categories.filter(c => c.id !== action.payload) };
    case 'UNLOCK_CATEGORY':
      return { ...state, unlockedCategoryIds: new Set([...state.unlockedCategoryIds, action.payload]) };
    case 'TOGGLE_EXPAND': {
      const next = new Set(state.expandedCategories);
      if (next.has(action.payload)) next.delete(action.payload);
      else next.add(action.payload);
      return { ...state, expandedCategories: next };
    }
    case 'SET_EXPANDED':
      return { ...state, expandedCategories: action.payload };
    default:
      return state;
  }
}

// --- Context ---
const CategoriesContext = createContext<CategoriesContextValue | null>(null);

// --- Helper ---
function buildCategoryTree(cats: Category[]): CategoryWithChildren[] {
  const topLevels = cats
    .filter(c => !c.parentId)
    .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));
  const subcategories = cats.filter(c => c.parentId);
  return topLevels.map(cat => ({
    ...cat,
    children: subcategories
      .filter(sub => sub.parentId === cat.id)
      .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0)),
  }));
}

// --- Provider ---
export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(categoriesReducer, {
    categories: [],
    unlockedCategoryIds: new Set(JSON.parse(localStorage.getItem('unlocked_categories') || '[]')),
    expandedCategories: new Set(),
  });

  const { authToken } = useAuthContext();

  const initCategories = useCallback((categories: Category[]) => {
    dispatch({ type: 'SET_CATEGORIES', payload: categories });
  }, []);

  const addCategory = useCallback((cat: Category) => {
    dispatch({ type: 'ADD_CATEGORY', payload: cat });
  }, []);

  const updateCategory = useCallback((cat: Category) => {
    dispatch({ type: 'UPDATE_CATEGORY', payload: cat });
  }, []);

  const deleteCategory = useCallback((id: string) => {
    dispatch({ type: 'DELETE_CATEGORY', payload: id });
  }, []);

  const unlockCategory = useCallback((id: string) => {
    const newSet = new Set([...state.unlockedCategoryIds, id]);
    localStorage.setItem('unlocked_categories', JSON.stringify(Array.from(newSet)));
    dispatch({ type: 'UNLOCK_CATEGORY', payload: id });
  }, [state.unlockedCategoryIds]);

  const toggleExpand = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_EXPAND', payload: id });
  }, []);

  const persist = useCallback((categories: Category[], links: LinkItem[]) => {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_KEY, JSON.stringify({ links, categories }));
    if (authToken) {
      fetch(API_ENDPOINTS.STORAGE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authToken,
        },
        body: JSON.stringify({ links, categories }),
      }).catch(e => console.error('Sync categories failed:', e));
    }
  }, [authToken]);

  const setCategoriesAndSync = useCallback((categories: Category[], links: LinkItem[]) => {
    dispatch({ type: 'SET_CATEGORIES', payload: categories });
    persist(categories, links);
  }, [persist]);

  const categoryTree = useMemo(() => buildCategoryTree(state.categories), [state.categories]);

  return (
    <CategoriesContext.Provider value={{
      ...state,
      initCategories,
      addCategory, updateCategory, deleteCategory,
      unlockCategory, toggleExpand, setCategoriesAndSync,
      categoryTree, buildCategoryTree,
    }}>
      {children}
    </CategoriesContext.Provider>
  );
}

// --- Hook ---
export function useCategoriesContext() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error('useCategoriesContext must be used within CategoriesProvider');
  return ctx;
}
