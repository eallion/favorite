// 统一存储接口 v2.4 - 修复分类移动/置顶后数据不一致问题
// 支持 EdgeOne Pages / Cloudflare Workers

import { getKV, getCorsHeaders, verifyAuth, jsonResponse } from './_kvAdapter.js';

const STORAGE_KEYS = {
  CONFIG_KEY: 'config',
  CATEGORIES_CONFIG_KEY: 'cate_config',
};

const CONFIG_SECTIONS = ['ai', 'website', 'mastodon', 'weather', 'search', 'icon', 'view', 'ui'];

async function readConfigSection(kv, section) {
  const sectionStr = await kv.get(`config:${section}`);
  if (sectionStr) return JSON.parse(sectionStr);
  const configStr = await kv.get('config');
  const config = configStr ? JSON.parse(configStr) : {};
  return config[section] || null;
}

async function mergeAllConfigSections(kv) {
  const merged = {};
  let hasAnyIndividual = false;
  const results = await Promise.all(CONFIG_SECTIONS.map(async (s) => {
    const v = await kv.get(`config:${s}`);
    if (v) { hasAnyIndividual = true; return [s, JSON.parse(v)]; }
    return null;
  }));
  for (const r of results) {
    if (r) merged[r[0]] = r[1];
  }
  if (hasAnyIndividual) {
    const configStr = await kv.get('config');
    if (configStr) {
      const legacy = JSON.parse(configStr);
      for (const s of CONFIG_SECTIONS) {
        if (!merged[s] && legacy[s]) merged[s] = legacy[s];
      }
    }
    return merged;
  }
  const configStr = await kv.get('config');
  return configStr ? JSON.parse(configStr) : {};
}

function categoryLinksKey(categoryId) {
  return `links:${categoryId}`;
}

// 读取所有分类链接（带密码过滤 + 私人书签过滤）
async function readAllCategoryLinks(kv, categories, unlockedCategories = new Set(), isAdmin = false) {
  if (categories.length === 0) return [];

  const linkPromises = categories.map(async (cat) => {
    const hasPassword = cat.password && cat.password.trim() !== '';
    const isUnlocked = unlockedCategories.has(cat.id);

    if (hasPassword && !isUnlocked && !isAdmin) {
      return [];
    }

    const data = await kv.get(categoryLinksKey(cat.id));
    return data ? JSON.parse(data) : [];
  });

  const linkArrays = await Promise.all(linkPromises);
  return linkArrays.flat();
}

// ===== 修复：保存链接时，先清理所有旧的分类链接数据，再重新写入 =====
async function saveCategoryLinks(kv, links, categories) {
  // 1. 先获取当前所有存在的分类 ID（包括传入的 categories 中的分类）
  const validCategoryIds = new Set(categories.map(c => c.id));

  // 2. 从 links 中提取所有被引用的分类 ID
  const referencedCategoryIds = new Set(links.map(l => l.categoryId || 'common'));

  // 3. 清理：删除所有不再有效的分类链接 key
  // 先读取现有的所有分类，找出那些已经不存在于 categories 数组中的分类
  const existingCategoriesData = await kv.get(STORAGE_KEYS.CATEGORIES_CONFIG_KEY);
  const existingCategories = existingCategoriesData ? JSON.parse(existingCategoriesData) : [];
  const allKnownCategoryIds = new Set([
    ...existingCategories.map(c => c.id),
    ...validCategoryIds,
  ]);

  // 4. 删除所有旧的 links:* key（确保没有残留数据）
  const deletePromises = [];
  for (const catId of allKnownCategoryIds) {
    deletePromises.push(kv.delete(categoryLinksKey(catId)));
  }
  await Promise.all(deletePromises);

  // 5. 按新的 categoryId 分组链接
  const grouped = {};
  for (const link of links) {
    const catId = link.categoryId || 'common';
    if (!grouped[catId]) grouped[catId] = [];
    grouped[catId].push(link);
  }

  // 6. 写入新的分组数据
  const writes = [];
  for (const [catId, catLinks] of Object.entries(grouped)) {
    writes.push(kv.put(categoryLinksKey(catId), JSON.stringify(catLinks)));
  }

  // 7. 对于空分类（没有链接的分类），写入空数组，确保 key 存在但为空
  for (const catId of validCategoryIds) {
    if (!grouped[catId]) {
      writes.push(kv.put(categoryLinksKey(catId), JSON.stringify([])));
    }
  }

  await Promise.all(writes);
}

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(env);
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const kv = getKV(env);

    if (request.method === 'GET') {
      const checkAuth = url.searchParams.get('checkAuth');
      const getConfig = url.searchParams.get('getConfig');
      const key = url.searchParams.get('key');
      const readOnly = url.searchParams.get('readOnly');
      const category = url.searchParams.get('category');
      const categoryPassword = url.searchParams.get('catPassword');

      if (checkAuth === 'true') {
        return jsonResponse({
          hasPassword: !!env.PASSWORD,
          requiresAuth: !!env.PASSWORD,
          readOnlyAccess: true,
          capabilities: { upload: true },
        }, 200, corsHeaders);
      }

      if (getConfig && getConfig.includes(',')) {
        const requestedSections = getConfig.split(',').filter(s => CONFIG_SECTIONS.includes(s) || s === 'true');
        const configMap = {};

        if (requestedSections.includes('true') || requestedSections.length === 0) {
          const categoriesData = await kv.get(STORAGE_KEYS.CATEGORIES_CONFIG_KEY);
          const allCategories = categoriesData ? JSON.parse(categoriesData) : [];

          let unlockedCategories = new Set();
          const unlockedParam = url.searchParams.get('unlocked');
          if (unlockedParam) {
            try { unlockedCategories = new Set(JSON.parse(unlockedParam)); } catch (e) {}
          }

          const providedPassword = request.headers.get('x-auth-password');
          const isAdmin = await verifyAuth({ providedPassword, serverPassword: env.PASSWORD, kv });

          const links = await readAllCategoryLinks(kv, allCategories, unlockedCategories, isAdmin);
          const sanitizedCategories = allCategories.map(({ password, ...rest }) => ({
            ...rest,
            hasPassword: !!(password && password.trim() !== '')
          }));

          const allConfig = await mergeAllConfigSections(kv);

          return jsonResponse({
            links,
            categories: sanitizedCategories,
            configs: allConfig,
          }, 200, corsHeaders);
        }

        await Promise.all(requestedSections.map(async (section) => {
          const val = await readConfigSection(kv, section);
          const configKey = section === 'mastodon' ? 'ticker' : section;
          configMap[configKey] = val || {};
        }));

        return jsonResponse(configMap, 200, corsHeaders);
      }

      if (CONFIG_SECTIONS.includes(getConfig)) {
        const sectionVal = await readConfigSection(kv, getConfig);
        const defaults = {
          website: { passwordExpiry: { value: 1, unit: 'week' } },
        };
        return jsonResponse(sectionVal || defaults[getConfig] || {}, 200, corsHeaders);
      }

      if (getConfig === 'favicon') {
        const domain = url.searchParams.get('domain');
        if (!domain) {
          return jsonResponse({ error: 'Domain parameter is required' }, 400, corsHeaders);
        }
        const cachedIcon = await kv.get(`favicon:${domain}`);
        return jsonResponse({ icon: cachedIcon || null, cached: !!cachedIcon }, 200, corsHeaders);
      }

      if (getConfig === 'categories') {
        const data = await kv.get(STORAGE_KEYS.CATEGORIES_CONFIG_KEY);
        const categories = data ? JSON.parse(data) : [];
        const sanitized = categories.map(({ password, ...rest }) => ({
          ...rest,
          hasPassword: !!(password && password.trim() !== '')
        }));
        return jsonResponse(sanitized, 200, corsHeaders);
      }

      let unlockedCategories = new Set();
      const unlockedParam = url.searchParams.get('unlocked');
      if (unlockedParam) {
        try {
          unlockedCategories = new Set(JSON.parse(unlockedParam));
        } catch (e) {}
      }

      const providedPassword = request.headers.get('x-auth-password');
      const isAdmin = await verifyAuth({
        providedPassword,
        serverPassword: env.PASSWORD,
        kv,
      });

      if (getConfig === 'links') {
        const categoriesData = await kv.get(STORAGE_KEYS.CATEGORIES_CONFIG_KEY);
        const categories = categoriesData ? JSON.parse(categoriesData) : [];

        if (category) {
          const cat = categories.find(c => c.id === category);
          if (!cat) {
            return jsonResponse({ error: '分类不存在' }, 404, corsHeaders);
          }

          const hasPassword = cat.password && cat.password.trim() !== '';
          let isUnlocked = unlockedCategories.has(category);

          if (categoryPassword && hasPassword && !isUnlocked && !isAdmin) {
            const inputPwd = categoryPassword.trim();
            const storedPwd = (cat.password || '').trim();
            if (inputPwd === storedPwd) {
              isUnlocked = true;
            } else {
              return jsonResponse({ error: '密码错误' }, 403, corsHeaders);
            }
          }

          if (hasPassword && !isUnlocked && !isAdmin) {
            return jsonResponse({ error: '该分类需要密码访问' }, 403, corsHeaders);
          }

          const data = await kv.get(categoryLinksKey(category));
          const links = data ? JSON.parse(data) : [];
          return jsonResponse(links, 200, corsHeaders);
        }

        const links = await readAllCategoryLinks(kv, categories, unlockedCategories, isAdmin);
        return jsonResponse(links, 200, corsHeaders);
      }

      if (key) {
        if (key === STORAGE_KEYS.CONFIG_KEY) {
          const merged = await mergeAllConfigSections(kv);
          return jsonResponse({ key, value: JSON.stringify(merged) }, 200, corsHeaders);
        }
        const value = await kv.get(key);
        return jsonResponse({ key, value }, 200, corsHeaders);
      }

      if (getConfig === 'true') {
        const categoriesData = await kv.get(STORAGE_KEYS.CATEGORIES_CONFIG_KEY);
        const allCategories = categoriesData ? JSON.parse(categoriesData) : [];

        const sanitizedCategories = allCategories.map(({ password, ...rest }) => ({
          ...rest,
          hasPassword: !!(password && password.trim() !== '')
        }));

        const links = await readAllCategoryLinks(kv, allCategories, unlockedCategories, isAdmin);

        return jsonResponse({
          links,
          categories: sanitizedCategories,
        }, 200, corsHeaders);
      }

      return jsonResponse({ links: [], categories: [] }, 200, corsHeaders);
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const readOnlyOperations = ['favicon'];

      if (readOnlyOperations.includes(body.operation) || body.saveConfig === 'favicon') {
        if (body.saveConfig === 'favicon') {
          const { domain, icon } = body;
          if (!domain || !icon) {
            return jsonResponse({ error: 'Domain and icon are required' }, 400, corsHeaders);
          }
          await kv.put(`favicon:${domain}`, icon, { expirationTtl: 30 * 24 * 60 * 60 });
          return jsonResponse({ success: true }, 200, corsHeaders);
        }
      }

      const providedPassword = request.headers.get('x-auth-password');
      const isAuthenticated = await verifyAuth({
        providedPassword,
        serverPassword: env.PASSWORD,
        kv,
      });

      if (!isAuthenticated) {
        return jsonResponse({ error: '管理操作需要密码验证' }, 401, corsHeaders);
      }

      if (body.authOnly) {
        await kv.put('last_auth_time', Date.now().toString());
        return jsonResponse({ success: true }, 200, corsHeaders);
      }

      if (CONFIG_SECTIONS.includes(body.saveConfig)) {
        await kv.put(`config:${body.saveConfig}`, JSON.stringify(body.config));
        return jsonResponse({ success: true }, 200, corsHeaders);
      }

      if (body.saveConfig === 'categories') {
        const existingData = await kv.get(STORAGE_KEYS.CATEGORIES_CONFIG_KEY);
        const existingCategories = existingData ? JSON.parse(existingData) : [];
        const existingPasswords = new Map(existingCategories.map(c => [c.id, c.password]));

        const mergedCategories = body.categories.map(cat => ({
          ...cat,
          password: cat.password || existingPasswords.get(cat.id) || undefined,
        }));

        await kv.put(STORAGE_KEYS.CATEGORIES_CONFIG_KEY, JSON.stringify(mergedCategories));
        return jsonResponse({ success: true }, 200, corsHeaders);
      }

      if (body.saveConfig === 'links') {
        if (body.categoryId) {
          await kv.put(categoryLinksKey(body.categoryId), JSON.stringify(body.links));
        } else {
          // 需要传入 categories 才能正确清理
          const categoriesData = await kv.get(STORAGE_KEYS.CATEGORIES_CONFIG_KEY);
          const categories = categoriesData ? JSON.parse(categoriesData) : [];
          await saveCategoryLinks(kv, body.links, categories);
        }
        return jsonResponse({ success: true }, 200, corsHeaders);
      }

      if (body.key === STORAGE_KEYS.CONFIG_KEY && body.value) {
        await kv.put('config', body.value);
        return jsonResponse({ success: true }, 200, corsHeaders);
      }

      if (body.key && body.value && body.key !== STORAGE_KEYS.CONFIG_KEY) {
        await kv.put(body.key, body.value);
        return jsonResponse({ success: true }, 200, corsHeaders);
      }

      // ===== 修复：同时保存 links 和 categories 时，传入 categories 进行完整清理 =====
      if (body.links && body.categories) {
        await saveCategoryLinks(kv, body.links, body.categories);

        const existingData = await kv.get(STORAGE_KEYS.CATEGORIES_CONFIG_KEY);
        const existingCategories = existingData ? JSON.parse(existingData) : [];
        const existingPasswords = new Map(existingCategories.map(c => [c.id, c.password]));

        const mergedCategories = body.categories.map(cat => ({
          ...cat,
          password: cat.password || existingPasswords.get(cat.id) || undefined,
        }));

        await kv.put(STORAGE_KEYS.CATEGORIES_CONFIG_KEY, JSON.stringify(mergedCategories));
        return jsonResponse({ success: true }, 200, corsHeaders);
      } else if (body.links) {
        const categoriesData = await kv.get(STORAGE_KEYS.CATEGORIES_CONFIG_KEY);
        const categories = categoriesData ? JSON.parse(categoriesData) : [];
        await saveCategoryLinks(kv, body.links, categories);
        return jsonResponse({ success: true }, 200, corsHeaders);
      } else if (body.categories) {
        const existingData = await kv.get(STORAGE_KEYS.CATEGORIES_CONFIG_KEY);
        const existingCategories = existingData ? JSON.parse(existingData) : [];
        const existingPasswords = new Map(existingCategories.map(c => [c.id, c.password]));

        const mergedCategories = body.categories.map(cat => ({
          ...cat,
          password: cat.password || existingPasswords.get(cat.id) || undefined,
        }));

        await kv.put(STORAGE_KEYS.CATEGORIES_CONFIG_KEY, JSON.stringify(mergedCategories));
        return jsonResponse({ success: true }, 200, corsHeaders);
      }

      return jsonResponse({ error: 'Invalid data format' }, 400, corsHeaders);
    }

    return jsonResponse({ error: 'Method Not Allowed' }, 405, corsHeaders);

  } catch (err) {
    console.error('Storage API error:', err);
    return jsonResponse({ error: 'Failed to fetch data', details: err.message }, 500, corsHeaders);
  }
}
