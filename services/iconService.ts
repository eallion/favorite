import { IconConfig, IconSourceType } from '../types';

export class IconService {
  private config: IconConfig;

  constructor(config: IconConfig) {
    this.config = config;
  }

  // 获取图标的统一方法
  async getIcon(url: string): Promise<string> {
    try {
      switch (this.config.source) {
        case 'faviconextractor':
          return await this.getFaviconExtractorIcon(url);
        case 'google':
          return await this.getGoogleIcon(url);
        case 'customapi':
          return await this.getCustomApiIcon(url);
        case 'customurl':
          return this.getCustomUrlIcon(url);
        default:
          return await this.getFaviconExtractorIcon(url);
      }
    } catch (error) {
      console.error('获取图标失败:', error);
      // 降级到默认方案
      return await this.getFaviconExtractorIcon(url);
    }
  }

  // 1. FaviconExtractor API
  private async getFaviconExtractorIcon(url: string): Promise<string> {
    const domain = new URL(url).hostname;
    return `https://www.faviconextractor.com/favicon/${domain}?larger=true`;
  }

  // 2. Google Favicon API
  private async getGoogleIcon(url: string): Promise<string> {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  }

  // 3. 自定义API
  private async getCustomApiIcon(url: string): Promise<string> {
    if (!this.config.customapi?.url) {
      throw new Error('自定义API未配置');
    }

    const response = await fetch(this.config.customapi.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.customapi.headers
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      throw new Error(`自定义API请求失败: ${response.statusText}`);
    }

    const data = await response.json();
    return data.iconUrl || data.url || data.favicon;
  }

  
  // 5. 自定义URL模板
  private getCustomUrlIcon(url: string): string {
    if (!this.config.customurl?.url) {
      throw new Error('自定义URL未配置');
    }

    const domain = new URL(url).hostname;
    return this.config.customurl.url.replace('{domain}', domain).replace('{url}', encodeURIComponent(url));
  }

  
  // 更新配置
  updateConfig(newConfig: IconConfig): void {
    this.config = newConfig;
  }

  // 获取当前配置
  getConfig(): IconConfig {
    return this.config;
  }
}

// 默认图标配置
export const DEFAULT_ICON_CONFIG: IconConfig = {
  source: 'google',
  faviconextractor: {
    enabled: true
  },
  google: {
    enabled: true
  },
  customapi: {
    enabled: false,
    url: ''
  },
  customurl: {
    enabled: false,
    url: ''
  }
};