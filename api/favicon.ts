// Vercel Serverless Favicon 代理接口
// 保持跨平台一致性，简洁注释

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCorsHeaders } from './_kvHelper.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const corsHeaders = getCorsHeaders();
  res.setHeader('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
  res.setHeader('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const domain = req.query.domain as string;
  if (!domain) {
    return res.status(400).json({ error: 'Domain required' });
  }

  // Vercel 运行环境下使用重定向降级处理，保障性能与跨平台兼容
  const fallbackUrl = `https://www.faviconextractor.com/favicon/${domain}?larger=true`;
  return res.redirect(302, fallbackUrl);
}
