// 应用常量定义

export const APP_CONFIG = {
  name: '蜗牛个人导航',
  version: '1.0.0',
  description: '现代化云端导航页面',
  githubUrl: 'https://github.com/eallion/favorite-cloudflare',
} as const

export const STORAGE_KEYS = {
  LOCAL_STORAGE_KEY: 'cloudnav_data_cache',
  AUTH_KEY: 'cloudnav_auth_token',
  CONFIG_KEY: 'config', // 统一配置
  CATEGORIES_CONFIG_KEY: 'cate_config',
  // 本地存储专用（用户个人偏好）
  VIEW_MODE_KEY: 'cloudnav_view_mode',
} as const

export const API_ENDPOINTS = {
  STORAGE: '/api/storage',
  LINK: '/api/link',
  WEBDAV: '/api/webdav',
  AUTH: '/api/auth',
} as const

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : process.env.VITE_ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
  'Access-Control-Max-Age': '86400',
} as const

export const SECURITY_CONFIG = {
  maxInputLength: 1000,
  maxUrlLength: 2048,
  passwordMinLength: 8,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 小时
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 分钟
} as const

export const UI_CONFIG = {
  gridBreakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  },
  animationDuration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  sidebarWidth: 320,
  headerHeight: 64,
} as const

export const DEFAULT_ICON_CONFIG = {
  source: 'google' as const,
  cacheEnabled: true,
  faviconextractor: {
    enabled: true,
  },
  google: {
    enabled: true,
  },
  customapi: {
    enabled: false,
    url: '',
    headers: {},
  },
  customurl: {
    enabled: false,
    url: '',
  },
} as const

export const SEARCH_ENGINES = [
  { id: 'internal', name: '站内搜索', url: '' },
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=' },
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=' },
  { id: 'yandex', name: 'Yandex', url: 'https://yandex.com/search/?text=' },
  { id: 'baidu', name: 'Baidu', url: 'https://www.baidu.com/s?wd=' },
  { id: 'so', name: '360 搜索', url: 'https://www.so.com/s?q=' },
] as const;
