import { AppConfig, WebDavConfig, SearchConfig, IconConfig, AIConfig, WebsiteConfig, TickerConfig, WeatherConfig } from '../../types';
import { STORAGE_KEYS } from '../constants';

// 默认配置
const DEFAULT_APP_CONFIG: AppConfig = {
  view: {
    mode: 'detailed',
    defaultMode: 'detailed',
  },
  ui: {
    showPinnedWebsites: true,
    darkMode: undefined, // 使用系统偏好
  },
};

/**
 * 配置管理器 - 统一管理所有配置，包括 AIConfig 和 WebsiteConfig
 */
class ConfigManager {
  private config: AppConfig = DEFAULT_APP_CONFIG;

  constructor() {
    this.loadFromLocalStorage();
  }

  /**
   * 从本地存储加载配置
   */
  loadFromLocalStorage(): AppConfig {
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG_KEY);
      if (savedConfig) {
        this.config = { ...DEFAULT_APP_CONFIG, ...JSON.parse(savedConfig) };
      } else {
        this.config = { ...DEFAULT_APP_CONFIG };
      }
      return this.config;
    } catch (error) {
      console.error('加载应用配置失败:', error);
      return DEFAULT_APP_CONFIG;
    }
  }

  /**
   * 保存配置到本地存储
   */
  saveToLocalStorage(config?: AppConfig): void {
    try {
      const configToSave = config || this.config;
      localStorage.setItem(STORAGE_KEYS.CONFIG_KEY, JSON.stringify(configToSave));
      this.config = configToSave;
    } catch (error) {
      console.error('保存应用配置失败:', error);
    }
  }

  /**
   * 获取完整配置
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * 更新 AI 配置
   */
  updateAIConfig(aiConfig: AIConfig): void {
    this.config.ai = aiConfig;
    this.saveToLocalStorage();
  }

  /**
   * 获取 AI 配置
   */
  getAIConfig(): AIConfig | undefined {
    return this.config.ai;
  }

  /**
   * 更新网站配置
   */
  updateWebsiteConfig(websiteConfig: WebsiteConfig): void {
    this.config.website = websiteConfig;
    this.saveToLocalStorage();
  }

  /**
   * 获取网站配置
   */
  getWebsiteConfig(): WebsiteConfig | undefined {
    return this.config.website;
  }

  /**
   * 更新 WebDAV 配置
   */
  updateWebDavConfig(webdavConfig: WebDavConfig): void {
    this.config.webdav = webdavConfig;
    this.saveToLocalStorage();
  }

  /**
   * 获取 WebDAV 配置
   */
  getWebDavConfig(): WebDavConfig | undefined {
    return this.config.webdav;
  }

  /**
   * 更新搜索配置
   */
  updateSearchConfig(searchConfig: SearchConfig): void {
    this.config.search = searchConfig;
    this.saveToLocalStorage();
  }

  /**
   * 获取搜索配置
   */
  getSearchConfig(): SearchConfig | undefined {
    return this.config.search;
  }

  /**
   * 更新图标配置
   */
  updateIconConfig(iconConfig: IconConfig): void {
    this.config.icon = iconConfig;
    this.saveToLocalStorage();
  }

  /**
   * 获取图标配置
   */
  getIconConfig(): IconConfig | undefined {
    return this.config.icon;
  }

  /**
   * 更新 Mastodon 配置
   */
  updateMastodonConfig(tickerConfig: TickerConfig): void {
    this.config.ticker = tickerConfig;
    this.saveToLocalStorage();
  }

  /**
   * 获取 Ticker 配置
   */
  getMastodonConfig(): TickerConfig | undefined {
    return this.config.ticker;
  }

  /**
   * 更新天气配置
   */
  updateWeatherConfig(weatherConfig: WeatherConfig): void {
    this.config.weather = weatherConfig;
    this.saveToLocalStorage();
  }

  /**
   * 获取天气配置
   */
  getWeatherConfig(): WeatherConfig | undefined {
    return this.config.weather;
  }

  /**
   * 更新视图模式
   */
  updateViewMode(mode: 'compact' | 'detailed', isDefault: boolean = false): void {
    if (!this.config.view) {
      this.config.view = {};
    }

    if (isDefault) {
      this.config.view.defaultMode = mode;
    } else {
      this.config.view.mode = mode;
    }
    this.saveToLocalStorage();
  }

  /**
   * 获取视图模式
   */
  getViewMode(): { mode: 'compact' | 'detailed'; defaultMode?: 'compact' | 'detailed' } {
    return this.config.view || { mode: 'detailed', defaultMode: 'detailed' };
  }

  /**
   * 更新界面配置
   */
  updateUIConfig(uiConfig: Partial<AppConfig['ui']>): void {
    this.config.ui = { ...this.config.ui, ...uiConfig };
    this.saveToLocalStorage();
  }

  /**
   * 获取界面配置
   */
  getUIConfig(): AppConfig['ui'] {
    return this.config.ui;
  }

  /**
   * 更新自定义偏好设置
   */
  updatePreferences(preferences: Record<string, any>): void {
    this.config.preferences = { ...this.config.preferences, ...preferences };
    this.saveToLocalStorage();
  }

  /**
   * 获取自定义偏好设置
   */
  getPreferences(): Record<string, any> | undefined {
    return this.config.preferences;
  }

  /**
   * 重置配置为默认值
   */
  resetToDefaults(): void {
    this.config = DEFAULT_APP_CONFIG;
    this.saveToLocalStorage();
  }

  /**
   * 同步配置到 KV 存储
   */
  async syncToKV(authToken: string): Promise<boolean> {
    try {
      const sections: Record<string, any> = {};
      if (this.config.ai) sections.ai = this.config.ai;
      if (this.config.website) sections.website = this.config.website;
      if (this.config.search) sections.search = this.config.search;
      if (this.config.icon) sections.icon = this.config.icon;
      if (this.config.ticker) sections.mastodon = this.config.ticker;
      if (this.config.weather) sections.weather = this.config.weather;
      if (this.config.view) sections.view = this.config.view;
      if (this.config.ui) sections.ui = this.config.ui;

      const results = await Promise.all(
        Object.entries(sections).map(async ([key, config]) => {
          const res = await fetch('/api/storage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-password': authToken,
            },
            body: JSON.stringify({ saveConfig: key, config }),
          });
          return res.ok;
        })
      );

      return results.every(Boolean);
    } catch (error) {
      console.error('同步配置到 KV 出错:', error);
      return false;
    }
  }

  /**
   * 从 KV 存储同步配置
   */
  async syncFromKV(authToken: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/storage?key=${STORAGE_KEYS.CONFIG_KEY}`, {
        headers: {
          'x-auth-password': authToken,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.value) {
          this.config = { ...DEFAULT_APP_CONFIG, ...JSON.parse(data.value) };
          this.saveToLocalStorage();
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('从 KV 同步配置出错:', error);
      return false;
    }
  }
}

// 导出单例实例
export const configManager = new ConfigManager();

// 导出便捷方法
export const loadAppConfig = () => configManager.loadFromLocalStorage();
export const saveAppConfig = (config?: AppConfig) => configManager.saveToLocalStorage(config);
export const getAppConfig = () => configManager.getConfig();
export const updateAIConfig = (config: AIConfig) => configManager.updateAIConfig(config);
export const getAIConfig = () => configManager.getAIConfig();
export const updateWebsiteConfig = (config: WebsiteConfig) => configManager.updateWebsiteConfig(config);
export const getWebsiteConfig = () => configManager.getWebsiteConfig();
export const updateWebDavConfig = (config: WebDavConfig) => configManager.updateWebDavConfig(config);
export const getWebDavConfig = () => configManager.getWebDavConfig();
export const updateSearchConfig = (config: SearchConfig) => configManager.updateSearchConfig(config);
export const getSearchConfig = () => configManager.getSearchConfig();
export const updateIconConfig = (config: IconConfig) => configManager.updateIconConfig(config);
export const getIconConfig = () => configManager.getIconConfig();
export const updateMastodonConfig = (config: TickerConfig) => configManager.updateMastodonConfig(config);
export const getMastodonConfig = () => configManager.getMastodonConfig();
export const updateWeatherConfig = (config: WeatherConfig) => configManager.updateWeatherConfig(config);
export const getWeatherConfig = () => configManager.getWeatherConfig();
export const updateViewMode = (mode: 'compact' | 'detailed', isDefault?: boolean) => configManager.updateViewMode(mode, isDefault);
export const getViewMode = () => configManager.getViewMode();
export const updateUIConfig = (config: Partial<AppConfig['ui']>) => configManager.updateUIConfig(config);
export const getUIConfig = () => configManager.getUIConfig();
export const syncConfigToKV = (authToken: string) => configManager.syncToKV(authToken);
export const syncConfigFromKV = (authToken: string) => configManager.syncFromKV(authToken);