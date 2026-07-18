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

export type AIProvider = 'google' | 'claude' | 'openai' | 'custom';

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
export type IconSourceType = 'faviconextractor' | 'google' | 'customapi' | 'customurl' | 'upload-edgeone' | 'upload-cloudflare';

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
export type SearchMode = 'internal' | 'external';

// 外部搜索源配置
export interface ExternalSearchSource {
  id: string;
  name: string;
  url: string;
  icon?: string;
  enabled: boolean;
  createdAt: number;
}

// 搜索配置
export interface SearchConfig {
  mode: SearchMode;
  externalSources: ExternalSearchSource[];
  selectedSource?: ExternalSearchSource | null; // 选中的搜索源
  defaultEngine?: string; // 默认搜索引擎 ID
  customEngineUrl?: string; // 自定义搜索引擎 URL
  customEngineIcon?: string; // 自定义搜索引擎 Logo (URL 或 SVG 代码)
}

// 滚动 Ticker 来源类型
export type TickerSource = 'mastodon' | 'memos' | 'custom';

// 滚动 Ticker 配置
export interface TickerConfig {
  enabled: boolean;
  source: TickerSource;
  // Mastodon
  mastodonInstance?: string;
  mastodonUsername?: string;
  mastodonLimit?: number;
  mastodonExcludeReplies?: boolean;
  mastodonExcludeReblogs?: boolean;
  // Memos
  memosHost?: string;
  memosToken?: string;
  memosLimit?: number;
  memosCreator?: string;
  memosVisibility?: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  // Custom
  customItems?: string[];
}

// 天气 API 类型
export type WeatherProvider = 'jinrishici' | 'qweather' | 'openweather' | 'visualcrossing' | 'accuweather';

// 天气配置
export interface WeatherConfig {
  enabled: boolean;
  provider: WeatherProvider;
  // QWeather
  qweatherHost?: string;
  qweatherApiKey?: string;
  qweatherLocation?: string;
  // OpenWeather
  openweatherApiKey?: string;
  openweatherCity?: string;
  // Visual Crossing
  visualcrossingApiKey?: string;
  visualcrossingLocation?: string;
  // AccuWeather
  accuweatherApiKey?: string;
  accuweatherLocationKey?: string;
  // Common
  unit?: 'celsius' | 'fahrenheit';
}

// 完全统一的应用配置（包含所有配置）
export interface AppConfig {
  // AI 配置
  ai?: AIConfig;

  // 网站配置
  website?: WebsiteConfig;

  // WebDAV 配置
  webdav?: WebDavConfig;

  // 搜索配置
  search?: SearchConfig;

  // 滚动 Ticker 配置
  ticker?: TickerConfig;

  // 天气配置
  weather?: WeatherConfig;

  // 图标配置
  icon?: IconConfig;

  // 视图配置
  view?: {
    mode: 'compact' | 'detailed'; // 用户个人视图偏好
    defaultMode?: 'compact' | 'detailed'; // 管理员设置的默认视图模式
  };

  // 界面配置
  ui?: {
    showPinnedWebsites: boolean; // 是否显示置顶网站
    darkMode?: boolean; // 深色模式偏好（可选，主要使用系统级主题）
  };

  // 其他用户偏好设置
  preferences?: {
    [key: string]: any;
  };
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "common", name: "常用推荐", icon: "Star" },
  { id: "tools","name":"工具","icon":"Folder","isSubcategory":false},
  { id: "life","name":"生活工具","icon":"Target","parentId":"tools","isSubcategory":true},
  { id: "network","name":"网络工具","icon":"Wifi","parentId":"tools","isSubcategory":true},
];

export const INITIAL_LINKS: LinkItem[] = [
  { id: 'init1', title: '博客 Blog', url: 'https://www.eallion.com/', icon: '/favicons/eallion.png', description: '大大的小蜗牛的个人生活博客', categoryId: 'common', createdAt: Date.now(), pinned: true, pinnedOrder: 0 },
  { id: 'init2', title: 'Mastodon e5n.cc', url: 'https://e5n.cc/@eallion', icon: '/favicons/mastodon.svg', description: 'Charles Chin\'s personal Mastodon.', categoryId: 'common', createdAt: Date.now(), pinned: true, pinnedOrder: 1 },
  { id: 'init3', title: 'Twitter 𝕏', url: 'https://x.com/eallion', icon: '/favicons/x.svg', description: 'Blaze your glory!', categoryId: 'common', createdAt: Date.now() },
  { id: 'init4', title: 'GitHub', url: 'https://github.com/eallion', icon: '/favicons/github.svg', description: 'Build and ship software on a single, collaborative platform', categoryId: 'common', createdAt: Date.now() },
  { id: 'init5', title: 'Cloudflare', url: 'https://dash.cloudflare.com/', icon: '/favicons/cloudflare.svg', description: 'Connect, protect, and build everywhere', categoryId: 'common', createdAt: Date.now() },
  { id: 'init6', title: 'Vercel', url: 'https://vercel.com', icon: '/favicons/vercel.svg', description: 'Build and deploy the best web experiences with the Frontend Cloud', categoryId: 'common', createdAt: Date.now() },
];
