// EdgeOne Pages & Cloudflare Pages Favicon 统一缓存与代理接口
// 支持在 EdgeOne Pages (Blob 存储) / Cloudflare Pages (R2 存储) 上使用二进制缓存
// 简洁注释以遵循用户全局规则

import { getCorsHeaders, jsonResponse, getKV } from './_kvAdapter.js';

// 外部 Favicon 抓取源（Google API 设置为默认/最高优先级）
const UPSTREAM_PROVIDERS = [
  (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
  (domain) => `https://www.faviconextractor.com/favicon/${domain}?larger=true`,
];

// 通过文件头魔数识别 MIME 类型
function detectMimeType(arrayBuffer) {
  const uint8 = new Uint8Array(arrayBuffer);
  if (uint8.length >= 8 && uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47) {
    return 'image/png';
  }
  if (uint8.length >= 2 && uint8[0] === 0xFF && uint8[1] === 0xD8) {
    return 'image/jpeg';
  }
  if (uint8.length >= 4 && uint8[0] === 0x47 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x38) {
    return 'image/gif';
  }
  if (uint8.length >= 4 && uint8[0] === 0x00 && uint8[1] === 0x00 && uint8[2] === 0x01 && uint8[3] === 0x00) {
    return 'image/x-icon';
  }
  if (uint8.length >= 12 &&
      uint8[0] === 0x52 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x46 &&
      uint8[8] === 0x57 && uint8[9] === 0x45 && uint8[10] === 0x42 && uint8[11] === 0x50) {
    return 'image/webp';
  }
  
  // 识别 SVG
  try {
    const decoder = new TextDecoder('utf-8');
    const prefix = decoder.decode(uint8.subarray(0, 150)).trim().toLowerCase();
    if (prefix.includes('<svg') || prefix.includes('<?xml')) {
      return 'image/svg+xml';
    }
  } catch (e) {}

  return 'image/x-icon';
}

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(env);
  const url = new URL(request.url);

  // 防盗链保护 (防站外盗用)
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererHost = new URL(referer).hostname;
      const requestHost = url.hostname;
      if (refererHost !== requestHost && refererHost !== 'localhost' && refererHost !== '127.0.0.1') {
        return new Response('Forbidden: Hotlinking is not allowed', { status: 403 });
      }
    } catch (e) {}
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405, corsHeaders);
  }

  const key = url.searchParams.get('key');
  const domain = url.searchParams.get('domain');

  if (!key && !domain) {
    return jsonResponse({ error: 'key or domain parameter required' }, 400, corsHeaders);
  }

  // 读取 KV 缓存配置状态（优先读独立 config:icon key，fallback 到旧 config）
  let cacheEnabled = true;
  try {
    const kv = getKV(env);
    let iconConfig = null;
    const iconStr = await kv.get('config:icon');
    if (iconStr) {
      iconConfig = JSON.parse(iconStr);
    } else {
      const configVal = await kv.get('config');
      if (configVal) {
        const config = JSON.parse(configVal);
        iconConfig = config?.icon || null;
      }
    }
    if (iconConfig && typeof iconConfig.cacheEnabled === 'boolean') {
      cacheEnabled = iconConfig.cacheEnabled;
    }
  } catch (err) {
    console.warn('Failed to read config from KV:', err);
  }

  const isCloudflareR2 = (env.CLOUDNAV_R2 && typeof env.CLOUDNAV_R2.get === 'function') || env.UPLOAD_PLATFORM === 'cloudflare';
  const storageKey = key || `favicon:${domain}`;

  // 1. 尝试从 R2 或 Blob 中获取数据
  try {
    if (isCloudflareR2) {
      if (env.CLOUDNAV_R2) {
        const object = await env.CLOUDNAV_R2.get(storageKey);
        if (object) {
          const cached = await object.arrayBuffer();
          const mime = detectMimeType(cached);
          return new Response(cached, {
            status: 200,
            headers: {
              'Content-Type': mime,
              'Cache-Control': 'public, max-age=31536000, immutable',
              ...corsHeaders
            }
          });
        }
      }
    } else {
      // EdgeOne Pages Blob
      let getStore;
      try {
        const blobSdk = await import('@edgeone/pages-blob');
        getStore = blobSdk.getStore;
      } catch (e) {
        console.warn('Failed to import @edgeone/pages-blob for read:', e);
      }

      if (getStore) {
        const store = getStore('favicons');
        const cached = await store.get(storageKey, { type: 'arrayBuffer' });
        if (cached) {
          const mime = detectMimeType(cached);
          return new Response(cached, {
            status: 200,
            headers: {
              'Content-Type': mime,
              'Cache-Control': 'public, max-age=31536000, immutable',
              ...corsHeaders
            }
          });
        }
      } else {
        console.warn('Blob store not available for read (getStore is undefined)');
      }
    }
  } catch (err) {
    console.error('Storage read error:', err);
  }

  // 如果请求的是自定义文件 key，但在存储中未找到，直接返回 404
  if (key) {
    return new Response('File Not Found', { status: 404, headers: corsHeaders });
  }

  // 2. 如果是 domain 请求且无缓存，则从上游抓取并保存
  let buffer = null;
  for (const getUrl of UPSTREAM_PROVIDERS) {
    try {
      const res = await fetch(getUrl(domain), {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res.ok) {
        buffer = await res.arrayBuffer();
        break;
      }
    } catch (e) {
      console.warn(`Fetch error for ${domain}:`, e);
    }
  }

  // 3. 抓取成功，存入 R2 或 Blob 并返回
  if (buffer) {
    if (cacheEnabled) {
      try {
        if (isCloudflareR2) {
          if (env.CLOUDNAV_R2) {
            const mime = detectMimeType(buffer);
            await env.CLOUDNAV_R2.put(storageKey, buffer, {
              httpMetadata: {
                contentType: mime,
                cacheControl: 'public, max-age=31536000'
              }
            });
          }
        } else {
          let getStore;
          try {
            const blobSdk = await import('@edgeone/pages-blob');
            getStore = blobSdk.getStore;
          } catch (e) {
            console.warn('Failed to import @edgeone/pages-blob for write:', e);
          }

          if (getStore) {
            const store = getStore('favicons');
            await store.set(storageKey, buffer, {
              cacheControl: 'public, max-age=31536000'
            });
          } else {
            console.warn('Blob store not available for write (getStore is undefined)');
          }
        }
      } catch (err) {
        console.error('Storage write error:', err);
      }
    }

    const mime = detectMimeType(buffer);
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=604800',
        ...corsHeaders
      }
    });
  }

  // 4. 最终降级：重定向至本地默认 favicon
  return Response.redirect(`${url.origin}/favicon.ico`, 302);
}
