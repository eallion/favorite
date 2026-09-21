import { useCallback, useRef } from 'react';
import { LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS } from '../../types';
import { STORAGE_KEYS, API_ENDPOINTS } from '../constants';
import { useLinksContext } from '../contexts/LinksContext';
import { useCategoriesContext } from '../contexts/CategoriesContext';
import { useConfigContext } from '../contexts/ConfigContext';
import { configManager } from '../utils/configManager';

/**
 * 数据同步 Hook：管理 localStorage ↔ KV 的加载和同步
 */
export function useDataSync() {
  const { links = [], initLinks, setLinksAndSync } = useLinksContext();
  const { categories = [], initCategories } = useCategoriesContext();
  const { initConfig } = useConfigContext();
  const initialized = useRef(false);

  // 从 localStorage 加载
  const loadFromLocal = useCallback((): { links: LinkItem[]; categories: Category[] } => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        let cats: Category[] = parsed.categories || DEFAULT_CATEGORIES;

        // 确保 common 分类存在且排第一
        if (cats.length > 0 && !cats.some(c => c.id === 'common')) {
          cats = [{ id: 'common', name: '常用推荐', icon: 'Star' }, ...cats];
        }

        return { links: parsed.links || INITIAL_LINKS, categories: cats };
      }
    } catch (e) {
      console.error('Load from local storage failed:', e);
    }
    return { links: INITIAL_LINKS, categories: DEFAULT_CATEGORIES };
  }, []);

  // 从 KV 加载链接和分类
  const loadFromCloud = useCallback(async (): Promise<{ links: LinkItem[]; categories: Category[] } | null> => {
    try {
      const res = await fetch(`${API_ENDPOINTS.STORAGE}?getConfig=true&readOnly=true`);
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

  // 从 KV 加载各个配置
  const loadConfigsFromCloud = useCallback(async () => {
    const configKeys = ['search', 'website', 'ai', 'weather', 'mastodon', 'icon', 'view', 'ui'];
    const configMap: Record<string, any> = {};

    await Promise.all(configKeys.map(async (key) => {
      try {
        const res = await fetch(`${API_ENDPOINTS.STORAGE}?getConfig=${key}`);
        if (res.ok) {
          const data = await res.json();
          if (data && Object.keys(data).length > 0) {
            if (key === 'view') {
              if (data.defaultMode) {
                configManager.updateViewMode(data.defaultMode, true);
                const userPref = localStorage.getItem('cloudnav_view_mode_preference');
                if (!userPref) {
                  configMap.viewMode = data.defaultMode;
                }
              }
            } else if (key === 'ui') {
              if (typeof data.showPinnedWebsites === 'boolean') {
                configMap.showPinnedWebsites = data.showPinnedWebsites;
              }
            } else {
              // 将后端命名的 'mastodon' 映射为前端统一使用的 'ticker'
              const configKey = key === 'mastodon' ? 'ticker' : key;
              configMap[configKey] = data;
            }
          }
        }
      } catch (e) {
        console.error(`Load config ${key} failed:`, e);
      }
    }));

    // 更新 ConfigContext
    if (Object.keys(configMap).length > 0) {
      initConfig(configMap);
    }
  }, [initConfig]);

  // 初始化数据
  const initData = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;

    // 1. 先从本地加载（快速展示）
    const local = loadFromLocal();
    initLinks(local.links);
    initCategories(local.categories);

    // 2. 并行从云端获取最新数据
    const [cloud] = await Promise.all([
      loadFromCloud(),
      loadConfigsFromCloud(),
    ]);

    if (cloud) {
      // 云端有数据，用云端数据覆盖
      let cats = cloud.categories || [];
      if (cats.length > 0 && !cats.some((c: Category) => c.id === 'common')) {
        cats = [{ id: 'common', name: '常用推荐', icon: 'Star' }, ...cats];
      }
      initLinks(cloud.links || []);
      initCategories(cats);
      // 更新 localStorage 缓存
      localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_KEY, JSON.stringify({
        links: cloud.links || [],
        categories: cats,
      }));
    }
  }, [loadFromLocal, loadFromCloud, loadConfigsFromCloud, initLinks, initCategories]);

  // 同步到云端
  const syncToCloud = useCallback(async () => {
    if (!links.length && !categories.length) return;
    setLinksAndSync(links, categories);
  }, [links, categories, setLinksAndSync]);

  return { initData, loadFromLocal, loadFromCloud, syncToCloud };
}
