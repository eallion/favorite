// EdgeOne Pages / Cloudflare Pages 统一上传接口
// 支持将图标上传到 EdgeOne Pages Blob (腾讯云) 或 Cloudflare R2 (S3/Cloudflare)
// 简洁注释以遵循用户全局规则

import { getKV, getCorsHeaders, verifyAuth, jsonResponse } from './_kvAdapter.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405, corsHeaders);
  }

  // 1. 认证检查
  let kv;
  try {
    kv = getKV(env);
  } catch (e) {
    if (!env.PASSWORD) {
      return jsonResponse({ error: 'KV or PASSWORD not configured' }, 500, corsHeaders);
    }
  }

  const providedPassword = request.headers.get('x-auth-password');
  const isAuthenticated = await verifyAuth({
    providedPassword,
    serverPassword: env.PASSWORD,
    kv,
  });

  if (!isAuthenticated) {
    return jsonResponse({ error: '需要密码验证' }, 401, corsHeaders);
  }

  // 处理删除请求 (DELETE)
  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const platform = url.searchParams.get('platform');
    if (!key) {
      return jsonResponse({ error: 'Key parameter required' }, 400, corsHeaders);
    }

    try {
      const isCloudflareR2 = platform === 'cloudflare' || (platform !== 'edgeone' && ((env.CLOUDNAV_R2 && typeof env.CLOUDNAV_R2.delete === 'function') || env.UPLOAD_PLATFORM === 'cloudflare'));

      if (isCloudflareR2) {
        if (!env.CLOUDNAV_R2) {
          return jsonResponse({ error: 'Cloudflare R2 binding CLOUDNAV_R2 not found' }, 500, corsHeaders);
        }
        await env.CLOUDNAV_R2.delete(key);
      } else {
        // EdgeOne Pages Blob
        let getStore;
        try {
          const blobSdk = await import('@edgeone/pages-blob');
          getStore = blobSdk.getStore;
        } catch (e) {}

        if (getStore) {
          const store = getStore('favicons');
          await store.delete(key);
        }
      }
      return jsonResponse({ success: true }, 200, corsHeaders);
    } catch (err) {
      console.error('Delete error:', err);
      return jsonResponse({ error: err.message }, 500, corsHeaders);
    }
  }

  try {
    const formData = await request.formData();
    let file = formData.get('file');
    let arrayBuffer;
    let contentType = 'image/png';
    let ext = 'png';
    let filename = 'icon.png';

    const fetchUrl = formData.get('url');
    if (!file && !fetchUrl) {
      return jsonResponse({ error: 'No file or url provided' }, 400, corsHeaders);
    }

    // 获取分类名并净化
    let categoryName = formData.get('categoryName') || 'common';
    categoryName = String(categoryName)
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim();
    if (!categoryName) {
      categoryName = 'common';
    }

    if (fetchUrl) {
      try {
        const fetchRes = await fetch(fetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (!fetchRes.ok) {
          return jsonResponse({ error: `Failed to fetch external URL: ${fetchRes.statusText}` }, 400, corsHeaders);
        }
        arrayBuffer = await fetchRes.arrayBuffer();
        contentType = fetchRes.headers.get('content-type') || 'image/png';
        
        const urlObj = new URL(fetchUrl);
        const pathExt = urlObj.pathname.split('.').pop();
        if (pathExt && /^[a-zA-Z0-9]+$/.test(pathExt) && pathExt.length < 5) {
          ext = pathExt.toLowerCase();
        } else if (contentType.includes('svg')) {
          ext = 'svg';
        } else if (contentType.includes('icon') || contentType.includes('x-icon')) {
          ext = 'ico';
        } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
          ext = 'jpg';
        } else if (contentType.includes('webp')) {
          ext = 'webp';
        } else if (contentType.includes('gif')) {
          ext = 'gif';
        }
        filename = `icon.${ext}`;
      } catch (fetchErr) {
        return jsonResponse({ error: `Fetch URL error: ${fetchErr.message}` }, 400, corsHeaders);
      }
    } else {
      arrayBuffer = await file.arrayBuffer();
      filename = file.name || 'icon.png';
      contentType = file.type || 'image/png';
      ext = filename.split('.').pop() || 'png';
    }
    
    // 生成唯一 Key 并按分类存放
    const randomId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    const key = `${categoryName}/${randomId}.${ext}`;

    // 2. 检测并上传到目标平台
    const platform = formData.get('platform');
    const isCloudflareR2 = platform === 'cloudflare' || (platform !== 'edgeone' && ((env.CLOUDNAV_R2 && typeof env.CLOUDNAV_R2.put === 'function') || env.UPLOAD_PLATFORM === 'cloudflare'));

    if (isCloudflareR2) {
      if (!env.CLOUDNAV_R2) {
        return jsonResponse({ error: 'Cloudflare R2 binding CLOUDNAV_R2 not found' }, 500, corsHeaders);
      }
      await env.CLOUDNAV_R2.put(key, arrayBuffer, {
        httpMetadata: {
          contentType: contentType,
          cacheControl: 'public, max-age=31536000',
        }
      });
    } else {
      // 默认使用 EdgeOne Pages Blob
      let getStore;
      try {
        const blobSdk = await import('@edgeone/pages-blob');
        getStore = blobSdk.getStore;
      } catch (e) {}

      if (!getStore) {
        return jsonResponse({ error: 'Storage backend not available' }, 500, corsHeaders);
      }

      const store = getStore('favicons');
      await store.set(key, arrayBuffer, {
        cacheControl: 'public, max-age=31536000'
      });
    }

    const iconUrl = `/api/favicon?key=${encodeURIComponent(key)}`;
    return jsonResponse({ success: true, url: iconUrl }, 200, corsHeaders);

  } catch (err) {
    console.error('Upload error:', err);
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}
