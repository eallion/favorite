// 统一存储接口 v2.1 - 分类密码保护
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

async function saveCategoryLinks(kv, links) {
  const grouped = {};
  for (const link of links) {
    const catId = link.categoryId || 'common';
    if (!grouped[catId]) grouped[catId] = [];
    grouped[catId].push(link);
  }

  const writes = Object.entries(grouped).map(([catId, catLinks]) =>
    kv.put(categoryLinksKey(catId), JSON.stringify(catLinks))
  );

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

      // 获取分类：密码脱敏，保留 hasPassword 标记
      if (getConfig === 'categories') {
        const data = await kv.get(STORAGE_KEYS.CATEGORIES_CONFIG_KEY);
        const categories = data ? JSON.parse(data) : [];

        // 调试：记录原始分类数量
        console.log(`[storage.js] Loaded ${categories.length} categories`);

        const sanitized = categories.map(({ password, ...rest }) => ({
          ...rest,
          hasPassword: !!(password && password.trim() !== '')
        }));

        // 调试：记录处理后的分类
        console.log(`[storage.js] Sanitized categories:`, JSON.stringify(sanitized.map(c => ({ id: c.id, name: c.name, hasPassword: c.hasPassword }))));

        return jsonResponse(sanitized, 200, corsHeaders);
      }

      // 解析已解锁分类
      let unlockedCategories = new Set();
      const unlockedParam = url.searchParams.get('unlocked');
      if (unlockedParam) {
        try {
          unlockedCategories = new Set(JSON.parse(unlockedParam));
        } catch (e) {}
      }

      // 检查管理员权限
      const providedPassword = request.headers.get('x-auth-password');
      const isAdmin = await verifyAuth({
        providedPassword,
        serverPassword: env.PASSWORD,
        kv,
      });

      // 获取链接（带密码过滤）
      if (getConfig === 'links') {
        const categoriesData = await kv.get(STORAGE_KEYS.CATEGORIES_CONFIG_KEY);
        const categories = categoriesData ? JSON.parse(categoriesData) : [];

        if (category) {
          const cat = categories.find(c => c.id === category);

          if (!cat) {
            console.log(`[storage.js] Category not found: ${category}`);
            console.log(`[storage.js] Available categories:`, categories.map(c => c.id));
            return jsonResponse({ error: '分类不存在' }, 404, corsHeaders);
          }

          const hasPassword = cat.password && cat.password.trim() !== '';
          let isUnlocked = unlockedCategories.has(category);

          // 如果提供了分类密码，验证它
          if (categoryPassword && hasPassword && !isUnlocked && !isAdmin) {
            const inputPwd = categoryPassword.trim();
            const storedPwd = (cat.password || '').trim();

            console.log(`[storage.js] Password check for ${category}: input="${inputPwd}" stored="${storedPwd}" match=${inputPwd === storedPwd}`);

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
          return new Response(data || '[]', {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
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

      // 获取全部数据（带密码过滤）
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
        await kv.put(STORAGE_KEYS.CATEGORIES_CONFIG_KEY, JSON.stringify(body.categories));
        return jsonResponse({ success: true }, 200, corsHeaders);
      }

      if (body.saveConfig === 'links') {
        if (body.categoryId) {
          await kv.put(categoryLinksKey(body.categoryId), JSON.stringify(body.links));
        } else {
          await saveCategoryLinks(kv, body.links);
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

      if (body.links && body.categories) {
        await saveCategoryLinks(kv, body.links);
        await kv.put(STORAGE_KEYS.CATEGORIES_CONFIG_KEY, JSON.stringify(body.categories));
        return jsonResponse({ success: true }, 200, corsHeaders);
      } else if (body.links) {
        await saveCategoryLinks(kv, body.links);
        return jsonResponse({ success: true }, 200, corsHeaders);
      } else if (body.categories) {
        await kv.put(STORAGE_KEYS.CATEGORIES_CONFIG_KEY, JSON.stringify(body.categories));
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
