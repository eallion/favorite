import { useCallback, useRef } from 'react';
import { LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS } from '../../types';
import { STORAGE_KEYS, API_ENDPOINTS } from '../constants';
import { useLinksContext } from '../contexts/LinksContext';
import { useCategoriesContext } from '../contexts/CategoriesContext';
import { useConfigContext } from '../contexts/ConfigContext';

export function useDataSync() {
  const { links = [], initLinks, setLinksAndSync } = useLinksContext();
  const { categories = [], initCategories, unlockedCategoryIds } = useCategoriesContext();
  const { initConfig } = useConfigContext();
  const initialized = useRef(false);

  const loadFromLocal = useCallback((): { links: LinkItem[]; categories: Category[] } => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        let cats: Category[] = parsed.categories || DEFAULT_CATEGORIES;

        if (!cats.some((c: Category) => c.id === 'common')) {
          cats = [{ id: 'common', name: '常用推荐', icon: 'Star' }, ...cats];
        } else {
          const idx = cats.findIndex((c: Category) => c.id === 'common');
          if (idx > 0) {
            const common = cats[idx];
            cats = [common, ...cats.slice(0, idx), ...cats.slice(idx + 1)];
          }
        }

        const validIds = new Set(cats.map((c: Category) => c.id));
        let lnks: LinkItem[] = (parsed.links || INITIAL_LINKS).map((l: LinkItem) =>
          validIds.has(l.categoryId) ? l : { ...l, categoryId: 'common' }
        );

        return { links: lnks, categories: cats };
      }
    } catch (e) {
      console.error('Load from local failed:', e);
    }
    return { links: INITIAL_LINKS, categories: DEFAULT_CATEGORIES };
  }, []);

  const loadFromCloud = useCallback(async (unlockedCats?: Set<string>): Promise<{ links: LinkItem[]; categories: Category[] } | null> => {
    try {
      const unlockedArray = unlockedCats ? Array.from(unlockedCats) : [];
      const res = await fetch(`${API_ENDPOINTS.STORAGE}?getConfig=true&readOnly=true&unlocked=${encodeURIComponent(JSON.stringify(unlockedArray))}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.links?.length > 0 || data.categories?.length > 0) {
        return { links: data.links || [], categories: data.categories || [] };
      }
      return null;
    } catch (e) {
      console.error('Load from cloud failed:', e);
      return null;
    }
  }, []);

  const loadConfigsFromCloud = useCallback(async () => {
    const configKeys = ['search', 'website', 'ai', 'weather', 'mastodon', 'icon'];
    const configMap: Record<string, any> = {};

    await Promise.all(configKeys.map(async (key) => {
      try {
        const res = await fetch(`${API_ENDPOINTS.STORAGE}?getConfig=${key}`);
        if (res.ok) {
          const data = await res.json();
          if (data && Object.keys(data).length > 0) {
            const configKey = key === 'mastodon' ? 'ticker' : key;
            configMap[configKey] = data;
          }
        }
      } catch (e) {
        console.error(`Load config ${key} failed:`, e);
      }
    }));

    if (Object.keys(configMap).length > 0) {
      initConfig(configMap);
    }
  }, [initConfig]);

  const initData = useCallback(async (unlockedCats?: Set<string>) => {
    if (initialized.current) return;
    initialized.current = true;

    const local = loadFromLocal();
    initLinks(local.links);
    initCategories(local.categories);

    const [cloud] = await Promise.all([
      loadFromCloud(unlockedCats),
      loadConfigsFromCloud(),
    ]);

    if (cloud) {
      let cats = cloud.categories || [];
      if (cats.length > 0 && !cats.some((c: Category) => c.id === 'common')) {
        cats = [{ id: 'common', name: '常用推荐', icon: 'Star' }, ...cats];
      }
      initLinks(cloud.links || []);
      initCategories(cats);
      localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_KEY, JSON.stringify({
        links: cloud.links || [],
        categories: cats,
      }));
    }
  }, [loadFromLocal, loadFromCloud, loadConfigsFromCloud, initLinks, initCategories]);

  const syncToCloud = useCallback(async () => {
    if (!links.length && !categories.length) return;
    setLinksAndSync(links, categories);
  }, [links, categories, setLinksAndSync]);

  return { initData, loadFromLocal, loadFromCloud, syncToCloud };
}
