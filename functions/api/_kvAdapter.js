// 跨平台 KV 适配层
// 支持 EdgeOne Pages (全局变量) / Cloudflare Workers (env 绑定)

/**
 * 获取 KV 实例，自动检测运行平台
 * @param {object} env - 函数 context.env
 * @returns {object} KV 实例
 */
export function getKV(env) {
  // Cloudflare Workers: KV 在 env 上
  if (env?.CLOUDNAV_KV && typeof env.CLOUDNAV_KV.get === 'function') {
    return env.CLOUDNAV_KV;
  }
  // EdgeOne Pages: KV 作为全局变量注入
  if (typeof CLOUDNAV_KV !== 'undefined' && typeof CLOUDNAV_KV.get === 'function') {
    return CLOUDNAV_KV;
  }
  throw new Error('KV binding "CLOUDNAV_KV" not found. Please check your deployment configuration.');
}

/**
 * 获取 CORS 头，支持配置化
 * @param {object} env - 函数 context.env
 * @returns {object} CORS headers
 */
export function getCorsHeaders(env) {
  const origin = env?.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * 认证检查：验证密码或 Token
 * @param {object} params
 * @param {string} params.providedPassword - 客户端提供的密码或 Token
 * @param {string} params.serverPassword - 环境变量中的密码
 * @param {object} params.kv - KV 实例
 * @returns {Promise<boolean>}
 */
export async function verifyAuth({ providedPassword, serverPassword, kv }) {
  if (!providedPassword) return false;

  // 直接匹配密码
  if (serverPassword && providedPassword === serverPassword) {
    return true;
  }

  // 防御性校验：如果不是合法的 Token 格式 (32字节随机 hex 字符，长度为 64)，直接拦截
  if (providedPassword.length !== 64 || !/^[0-9a-f]{64}$/i.test(providedPassword)) {
    return false;
  }

  // 查 KV 中的 Token
  try {
    const tokenVal = await kv.get(`auth_token:${providedPassword}`);
    return tokenVal === 'valid';
  } catch {
    return false;
  }
}

/**
 * 创建标准 JSON 响应
 * @param {any} data - 响应数据
 * @param {number} status - HTTP 状态码
 * @param {object} extraHeaders - 额外响应头
 * @returns {Response}
 */
export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}
