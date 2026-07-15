export interface LinkItem {
  id: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  categoryId: string;
  createdAt: number;
  pinned?: boolean;
  pinnedOrder?: number;
  order?: number;
  weight?: number;
  iconType?: string;
  iconConfig?: Record<string, unknown>;
  customIconUrl?: string;
  edgeoneBlobUrl?: string;
  cloudflareR2Url?: string;
  isPrivate?: boolean; // 私人书签
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  password?: string;
  parentId?: string;
  isSubcategory?: boolean;
  weight?: number;
}

export interface AppState {
  links: LinkItem[];
  categories: Category[];
  darkMode: boolean;
}

export interface WebDavConfig {
  url: string;
  username: string;
  password: string;
  enabled: boolean;
}

export interface AIProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  providers?: Partial<Record<AIProvider, AIProviderConfig>>;
  websiteTitle?: string;
  faviconUrl?: string;
  navigationName?: string;
  sidebarNavigationName?: string;
  defaultViewMode?: 'compact' | 'detailed';
}

// 图标获取方式类型
export type IconSourceType = 'faviconextractor' | 'google' | 'customapi' | 'customurl' | 'upload-edgeone' | 'upload-cloudflare' | 'xinac';

// 图标配置
export interface IconConfig {
  source: IconSourceType;
  cacheEnabled?: boolean;
  faviconextractor?: {
    enabled: boolean;
  };
  google?: {
    enabled: boolean;
    apiKey?: string;
  };
  customapi?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
  };
  customurl?: {
    enabled: boolean;
    url: string;
  };
}

// 密码过期时间单位
export type PasswordExpiryUnit = 'day' | 'week' | 'month' | 'year' | 'permanent';

// 密码过期时间配置
export interface PasswordExpiryConfig {
  value: number; // 数值
  unit: PasswordExpiryUnit; // 单位
}

// 网站配置
export interface WebsiteConfig {
  passwordExpiry: PasswordExpiryConfig;
}

// 搜索模式类型
export type SearchMode = 'internal' | 'external' | 'hybrid';

// 搜索来源配置
export interface SearchSourceConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

// 搜索配置
export interface SearchConfig {
  mode: SearchMode;
  externalSources: SearchSourceConfig[];
  defaultEngine?: string;
}

// 天气配置
export interface WeatherConfig {
  enabled: boolean;
  city: string;
  apiKey?: string;
  provider?: string;
}

// Mastodon/Ticker 配置
export interface MastodonConfig {
  enabled: boolean;
  instance: string;
  account: string;
  maxItems: number;
}

// AI Provider 类型
export type AIProvider = 'gemini' | 'openai' | 'claude' | 'custom';

// 默认分类
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'common', name: '常用推荐', icon: 'Star' },
];

// 初始链接数据
export const INITIAL_LINKS: LinkItem[] = [
  {
    id: '1',
    title: '百度',
    url: 'https://www.baidu.com',
    icon: 'https://www.baidu.com/favicon.ico',
    categoryId: 'common',
    createdAt: Date.now(),
  },
  {
    id: '2',
    title: 'GitHub',
    url: 'https://github.com',
    icon: 'https://github.com/favicon.ico',
    categoryId: 'common',
    createdAt: Date.now(),
  },
  {
    id: '3',
    title: 'Google',
    url: 'https://www.google.com',
    icon: 'https://www.google.com/favicon.ico',
    categoryId: 'common',
    createdAt: Date.now(),
  },
];
