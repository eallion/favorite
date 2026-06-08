import React, { useState, useEffect } from 'react';
import { X, Save, Settings, Clock, LayoutGrid, MessageCircle, Cloud, BookOpen, Upload, CloudCog, LogOut, Loader2, Plus, Trash2, Search } from 'lucide-react';
import { AIConfig, PasswordExpiryConfig, TickerConfig, WeatherConfig, WeatherProvider, TickerSource, SearchConfig, IconConfig } from '../types';
import { toast } from './Toast';
import { SEARCH_ENGINES, DEFAULT_ICON_CONFIG } from '../src/constants';

interface SettingsData {
  ai: AIConfig;
  passwordExpiry: PasswordExpiryConfig;
  ticker: TickerConfig;
  weather: WeatherConfig;
  showPinnedWebsites: boolean;
  defaultViewMode: 'compact' | 'detailed';
  search: SearchConfig;
  icon: IconConfig;
}

const DEFAULT_SETTINGS: SettingsData = {
  ai: { 
    provider: 'google', 
    apiKey: '', 
    baseUrl: 'https://generativelanguage.googleapis.com', 
    model: 'gemini-3.1-flash-lite', 
    websiteTitle: '', 
    navigationName: '', 
    faviconUrl: '',
    providers: {
      google: { apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-3.1-flash-lite' },
      openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-nano' },
      claude: { apiKey: '', baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-4-5' },
    }
  },
  passwordExpiry: { value: 1, unit: 'week' },
  ticker: { enabled: false, source: 'mastodon', customItems: [] },
  weather: { enabled: false, provider: 'jinrishici', unit: 'celsius' },
  showPinnedWebsites: true,
  defaultViewMode: 'detailed',
  search: { mode: 'internal', externalSources: [], selectedSource: null, defaultEngine: 'internal' },
  icon: DEFAULT_ICON_CONFIG,
};

const AI_MODELS: Record<string, { label: string; defaultModel: string; defaultBaseUrl: string }> = {
  google: { label: 'Google Gemini', defaultModel: 'gemini-3.1-flash-lite', defaultBaseUrl: 'https://generativelanguage.googleapis.com' },
  openai: { label: 'OpenAI', defaultModel: 'gpt-5-nano', defaultBaseUrl: 'https://api.openai.com/v1' },
  claude: { label: 'Claude', defaultModel: 'claude-haiku-4-5', defaultBaseUrl: 'https://api.anthropic.com' },
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
  onSettingsLoaded: (settings: SettingsData) => void;
  onImportClick: () => void;
  onBackupClick: () => void;
  supportsUpload?: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, authToken, onSettingsLoaded, onImportClick, onBackupClick, supportsUpload = true
}) => {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [mastodonInput, setMastodonInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const fetchSettings = async () => {
      setLoading(true);
      try {
        // 1. Try to fetch new config key
        let res = await fetch('/api/storage?key=config');
        let data = res.ok ? await res.json() : null;

        if (data?.value) {
          // Mapping AppConfig to SettingsData structure
          const appConfig = JSON.parse(data.value);
          
          // Ensure providers map exists
          const aiConfig = appConfig.ai || DEFAULT_SETTINGS.ai;
          if (!aiConfig.providers) {
            aiConfig.providers = { ...DEFAULT_SETTINGS.ai.providers };
            // Migration: put current active settings into the map
            if (aiConfig.provider && aiConfig.providers[aiConfig.provider]) {
              aiConfig.providers[aiConfig.provider] = {
                apiKey: aiConfig.apiKey || '',
                baseUrl: aiConfig.baseUrl || AI_MODELS[aiConfig.provider]?.defaultBaseUrl || '',
                model: aiConfig.model || AI_MODELS[aiConfig.provider]?.defaultModel || '',
              };
            }
          }

          setSettings(prev => ({
            ...prev,
            ai: aiConfig,
            passwordExpiry: appConfig.website?.passwordExpiry || prev.passwordExpiry,
            ticker: appConfig.ticker || appConfig.mastodon || prev.ticker,
            weather: appConfig.weather || prev.weather,
            showPinnedWebsites: appConfig.ui?.showPinnedWebsites ?? prev.showPinnedWebsites,
            defaultViewMode: appConfig.view?.defaultMode || appConfig.view?.mode || prev.defaultViewMode,
            search: appConfig.search || prev.search,
            icon: appConfig.icon || prev.icon || DEFAULT_ICON_CONFIG,
          }));
          
          const ticker = appConfig.ticker || appConfig.mastodon;
          if (ticker?.mastodonUsername && ticker?.mastodonInstance) {
            setMastodonInput(`@${ticker.mastodonUsername}@${ticker.mastodonInstance}`);
          }
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [isOpen]);

  const handleSave = async () => {
    if (!authToken) { toast.error('请先登录'); return; }
    setSaving(true);
    try {
      const tickerConfig = { ...settings.ticker };
      if (tickerConfig.source === 'mastodon' && mastodonInput) {
        const match = mastodonInput.match(/^@?([^@]+)@(.+)$/);
        if (match) { tickerConfig.mastodonUsername = match[1]; tickerConfig.mastodonInstance = match[2]; }
      }

      const finalSettings = { ...settings, ticker: tickerConfig };

      const sections: Record<string, any> = {
        ai: finalSettings.ai,
        website: { passwordExpiry: finalSettings.passwordExpiry },
        mastodon: finalSettings.ticker,
        weather: finalSettings.weather,
        search: finalSettings.search,
        icon: finalSettings.icon,
        ui: { showPinnedWebsites: finalSettings.showPinnedWebsites },
        view: { defaultMode: finalSettings.defaultViewMode },
      };

      const results = await Promise.all(
        Object.entries(sections).map(async ([key, config]) => {
          const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-password': authToken },
            body: JSON.stringify({ saveConfig: key, config }),
          });
          return { key, ok: res.ok, error: res.ok ? null : ((await res.json().catch(() => ({}))).error || res.statusText) };
        })
      );

      const errors = results.filter(r => !r.ok).map(r => `${r.key}: ${r.error}`);
      if (errors.length > 0) {
        console.error('Settings save partial errors:', errors);
        toast.error(`部分设置保存失败: ${errors.join('; ')}`);
      } else {
        setSettings(finalSettings);
        onSettingsLoaded(finalSettings);
        toast.success('设置已保存');
        onClose();
      }
    } catch (e) { console.error('Settings save error:', e); toast.error(`保存失败: ${e instanceof Error ? e.message : '未知错误'}`); } finally { setSaving(false); }
  };

  const update = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateAI = (key: keyof AIConfig, value: any) => {
    setSettings(prev => {
      const newAi = { ...prev.ai, [key]: value };
      
      // If updating provider, load stored settings for new provider
      if (key === 'provider') {
        const provider = value as keyof typeof AI_MODELS;
        const stored = newAi.providers?.[provider];
        if (stored) {
          newAi.apiKey = stored.apiKey;
          newAi.baseUrl = stored.baseUrl;
          newAi.model = stored.model;
        } else {
          // Fallback to defaults if no stored config
          const defaults = AI_MODELS[provider];
          if (defaults) {
            newAi.apiKey = '';
            newAi.baseUrl = defaults.defaultBaseUrl;
            newAi.model = defaults.defaultModel;
          }
        }
      } 
      // If updating specific field, sync with providers map
      else if (['apiKey', 'baseUrl', 'model'].includes(key as string)) {
        const provider = newAi.provider;
        if (!newAi.providers) newAi.providers = {};
        newAi.providers[provider] = {
          ...(newAi.providers[provider] || { apiKey: '', baseUrl: '', model: '' }),
          [key]: value
        };
      }
      
      return { ...prev, ai: newAi };
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('cloudnav_auth_token');
    localStorage.removeItem('lastLoginTime');
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { isAuthenticated: false } }));
    onClose();
    toast.success('已成功退出登录');
  };

  const handleMigrateIcons = async () => {
    if (!authToken) { toast.error('请先登录'); return; }
    if (migrating) return;
    setMigrating(true);
    try {
      const res = await fetch('/api/migrate-icons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-password': authToken },
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(`迁移完成: 共 ${result.total} 个链接，缓存 ${result.cached} 个，失败 ${result.failed} 个，跳过 ${result.skipped} 个`);
      } else {
        toast.error(`迁移失败: ${result.error || res.statusText}`);
      }
    } catch (e) {
      toast.error(`迁移请求失败: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setMigrating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Settings size={20} /> 设置面板
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={handleLogout} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors group" title="退出登录">
              <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-600 transition-colors" />
            </button>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
              <X className="w-5 h-5 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
              <span className="ml-3 text-slate-500">加载设置中...</span>
            </div>
          ) : (
            <>
              {/* 浏览器标签标题 */}
              <section>
                <h4 className="font-bold dark:text-white mb-3 text-sm flex items-center gap-2">
                  <Settings size={16} /> 浏览器标签标题设置
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">网站标题</label>
                    <input type="text" value={settings.ai.websiteTitle || ''} onChange={(e) => updateAI('websiteTitle', e.target.value)} placeholder="蜗牛个人导航" className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">网页导航名称</label>
                      <input type="text" value={settings.ai.navigationName || ''} onChange={(e) => updateAI('navigationName', e.target.value)} placeholder="蜗牛导航" className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">侧边栏网页导航名称</label>
                      <input type="text" value={settings.ai.sidebarNavigationName || ''} onChange={(e) => updateAI('sidebarNavigationName', e.target.value)} placeholder="留空则默认与网页导航名称相同" className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">网站图标 URL</label>
                    <input type="text" value={settings.ai.faviconUrl || ''} onChange={(e) => updateAI('faviconUrl', e.target.value)} placeholder="/favicon.ico" className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </section>

              {/* 密码过期 */}
              <section className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold dark:text-white mb-3 text-sm flex items-center gap-2">
                  <Clock size={16} /> 密码过期时间
                </h4>
                <div className="flex gap-3">
                  <input type="number" value={settings.passwordExpiry.value} onChange={(e) => update('passwordExpiry', { ...settings.passwordExpiry, value: parseInt(e.target.value) || 1 })} min={1} className="w-24 h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                  <select value={settings.passwordExpiry.unit} onChange={(e) => update('passwordExpiry', { ...settings.passwordExpiry, unit: e.target.value as any })} className="flex-1 h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="day">天</option>
                    <option value="week">周</option>
                    <option value="month">月</option>
                    <option value="year">年</option>
                  </select>
                </div>
              </section>

              {/* 搜索设置 */}
              <section className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold dark:text-white mb-3 text-sm flex items-center gap-2">
                  <Search size={16} /> 搜索设置
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">默认搜索引擎</label>
                    <select 
                      value={settings.search.defaultEngine || 'internal'} 
                      onChange={(e) => update('search', { ...settings.search, defaultEngine: e.target.value })} 
                      className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {SEARCH_ENGINES.map(engine => (
                        <option key={engine.id} value={engine.id}>{engine.name}</option>
                      ))}
                      <option value="custom">自定义</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">选择“站内搜索”时，搜索框默认搜索本站链接；选择其他搜索引擎则默认搜索互联网。</p>
                  </div>
                  {settings.search.defaultEngine === 'custom' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">自定义搜索 URL</label>
                        <input 
                          type="text" 
                          value={settings.search.customEngineUrl || ''} 
                          onChange={(e) => update('search', { ...settings.search, customEngineUrl: e.target.value })} 
                          placeholder="https://example.com/search?q=" 
                          className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                        />
                        <p className="text-[10px] text-slate-400 mt-1">请输入搜索 URL，关键词将拼接在末尾。</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">自定义 Logo (URL 或 SVG 代码)</label>
                        <textarea 
                          value={settings.search.customEngineIcon || ''} 
                          onChange={(e) => update('search', { ...settings.search, customEngineIcon: e.target.value })} 
                          placeholder="https://example.com/logo.png 或 <svg>...</svg>" 
                          className="w-full h-24 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-xs" 
                        />
                        <p className="text-[10px] text-slate-400 mt-1">支持图片 URL 或直接输入 SVG 代码。</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* 默认视图模式 */}
              <section className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold dark:text-white mb-3 text-sm flex items-center gap-2">
                  <LayoutGrid size={16} /> 默认视图模式
                </h4>
                <div className="flex gap-3">
                  <button onClick={() => update('defaultViewMode', 'compact')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${settings.defaultViewMode === 'compact' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-2 border-blue-500' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-transparent'}`}>简约</button>
                  <button onClick={() => update('defaultViewMode', 'detailed')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${settings.defaultViewMode === 'detailed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-2 border-blue-500' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-transparent'}`}>详细</button>
                </div>
              </section>

              {/* 置顶网站 */}
              <section className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold dark:text-white mb-3 text-sm flex items-center gap-2">
                  <LayoutGrid size={16} /> 置顶网站
                </h4>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.showPinnedWebsites} onChange={(e) => update('showPinnedWebsites', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">显示置顶网站区域</span>
                </label>
              </section>

              {/* 图标自托管与缓存 */}
              <section className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold dark:text-white mb-3 text-sm flex items-center gap-2">
                  <LayoutGrid size={16} /> 图标自托管与缓存
                </h4>
                <div className="space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={settings.icon?.cacheEnabled !== false} 
                      onChange={(e) => update('icon', { ...(settings.icon || { source: 'google' }), cacheEnabled: e.target.checked })} 
                      className="w-5 h-5 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                    />
                    <div>
                      <span className="text-sm text-slate-700 dark:text-slate-300 block font-medium">启用边缘抓取缓存</span>
                      <span className="text-xs text-slate-400 block mt-0.5">开启后，域名图标首次抓取后自动缓存到平台存储（EdgeOne → Blob，Cloudflare → R2）。免费用户可取消以节省存储空间。</span>
                    </div>
                  </label>
                    {supportsUpload && (
                      <>
                        <button
                          onClick={handleMigrateIcons}
                          disabled={migrating}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors"
                        >
                          {migrating ? <Loader2 className="animate-spin w-4 h-4" /> : <Upload size={16} />}
                          {migrating ? '迁移中...' : '迁移历史图标到平台存储'}
                        </button>
                        <p className="text-[10px] text-slate-400 text-center">将历史链接的域名图标抓取后缓存到平台存储（EdgeOne → Blob，Cloudflare → R2），系统自动检测。关闭「边缘抓取缓存」后改用上游源。</p>
                      </>
                    )}
                  </div>
              </section>

              {/* 滚动 Ticker */}
              <section className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold dark:text-white mb-3 text-sm flex items-center gap-2">
                  <MessageCircle size={16} /> 滚动 Ticker
                </h4>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={settings.ticker.enabled} onChange={(e) => update('ticker', { ...settings.ticker, enabled: e.target.checked })} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">启用滚动 Ticker</span>
                  </label>
                  {settings.ticker.enabled && (
                    <div className="space-y-4 pl-8">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">数据来源</label>
                        <select value={settings.ticker.source} onChange={(e) => update('ticker', { ...settings.ticker, source: e.target.value as TickerSource })} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                          <option value="mastodon">Mastodon</option>
                          <option value="memos">Memos</option>
                          <option value="custom">自定义</option>
                        </select>
                      </div>

                      {/* Mastodon 配置 */}
                      {settings.ticker.source === 'mastodon' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">用户地址</label>
                            <input type="text" value={mastodonInput} onChange={(e) => setMastodonInput(e.target.value)} placeholder="@username@instance.com" className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">显示条数</label>
                            <input type="number" value={settings.ticker.mastodonLimit || 10} onChange={(e) => update('ticker', { ...settings.ticker, mastodonLimit: parseInt(e.target.value) || 10 })} min={1} max={40} className="w-24 h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={settings.ticker.mastodonExcludeReplies !== false} onChange={(e) => update('ticker', { ...settings.ticker, mastodonExcludeReplies: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                              <span className="text-xs text-slate-600 dark:text-slate-400">排除回复</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={settings.ticker.mastodonExcludeReblogs !== false} onChange={(e) => update('ticker', { ...settings.ticker, mastodonExcludeReblogs: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                              <span className="text-xs text-slate-600 dark:text-slate-400">排除转嘟</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Memos 配置 */}
                      {settings.ticker.source === 'memos' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Memos 地址</label>
                            <input type="text" value={settings.ticker.memosHost || ''} onChange={(e) => update('ticker', { ...settings.ticker, memosHost: e.target.value })} placeholder="https://memos.example.com" className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">API Token</label>
                            <input type="password" value={settings.ticker.memosToken || ''} onChange={(e) => update('ticker', { ...settings.ticker, memosToken: e.target.value })} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">用户名</label>
                            <input type="text" value={settings.ticker.memosCreator || ''} onChange={(e) => update('ticker', { ...settings.ticker, memosCreator: e.target.value })} placeholder="john" className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                            <p className="text-[10px] text-slate-400 mt-1">只填用户名，如 john，系统自动拼接为 users/john</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">可见性</label>
                            <select value={settings.ticker.memosVisibility || 'PUBLIC'} onChange={(e) => update('ticker', { ...settings.ticker, memosVisibility: e.target.value as 'PUBLIC' | 'PROTECTED' | 'PRIVATE' })} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                              <option value="PUBLIC">公开 (PUBLIC)</option>
                              <option value="PROTECTED">受保护 (PROTECTED)</option>
                              <option value="PRIVATE">私有 (PRIVATE)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">显示条数</label>
                            <input type="number" value={settings.ticker.memosLimit || 10} onChange={(e) => update('ticker', { ...settings.ticker, memosLimit: parseInt(e.target.value) || 10 })} min={1} className="w-24 h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                        </div>
                      )}

                      {/* 自定义配置 */}
                      {settings.ticker.source === 'custom' && (
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-slate-500 mb-1">自定义内容</label>
                          {(settings.ticker.customItems || []).map((item, index) => (
                            <div key={index} className="flex gap-2">
                              <input type="text" value={item} onChange={(e) => {
                                const newItems = [...(settings.ticker.customItems || [])];
                                newItems[index] = e.target.value;
                                update('ticker', { ...settings.ticker, customItems: newItems });
                              }} className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                              <button onClick={() => {
                                const newItems = (settings.ticker.customItems || []).filter((_, i) => i !== index);
                                update('ticker', { ...settings.ticker, customItems: newItems });
                              }} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={14} /></button>
                            </div>
                          ))}
                          <button onClick={() => update('ticker', { ...settings.ticker, customItems: [...(settings.ticker.customItems || []), ''] })} className="flex items-center gap-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                            <Plus size={14} /> 添加项目
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* 天气设置 */}
              <section className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold dark:text-white mb-3 text-sm flex items-center gap-2">
                  <Cloud size={16} /> 天气设置
                </h4>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={settings.weather.enabled} onChange={(e) => update('weather', { ...settings.weather, enabled: e.target.checked })} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">启用天气显示</span>
                  </label>
                  {settings.weather.enabled && (
                    <div className="space-y-4 pl-8">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium text-slate-500">天气 API</label>
                          {settings.weather.provider === 'qweather' && <a href="https://dev.qweather.com/docs/api/" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">和风天气 API 文档</a>}
                          {settings.weather.provider === 'openweather' && <a href="https://openweathermap.org/api" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">OpenWeather API</a>}
                          {settings.weather.provider === 'visualcrossing' && <a href="https://www.visualcrossing.com/weather-api" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">Visual Crossing API</a>}
                          {settings.weather.provider === 'accuweather' && <a href="https://developer.accuweather.com/apis" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">AccuWeather API</a>}
                        </div>
                        <select value={settings.weather.provider} onChange={(e) => update('weather', { ...settings.weather, provider: e.target.value as WeatherProvider })} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                          <option value="jinrishici">今日诗词（默认，免费）</option>
                          <option value="qweather">和风天气 QWeather</option>
                          <option value="openweather">OpenWeather</option>
                          <option value="visualcrossing">Visual Crossing</option>
                          <option value="accuweather">AccuWeather</option>
                        </select>
                      </div>

                      {settings.weather.provider === 'jinrishici' && (
                        <p className="text-xs text-slate-400">使用今日诗词 API，无需配置，勾选即启用。</p>
                      )}

                      {settings.weather.provider === 'qweather' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">API Host</label>
                            <input type="text" value={settings.weather.qweatherHost || ''} onChange={(e) => update('weather', { ...settings.weather, qweatherHost: e.target.value })} placeholder="xxxx.re.qweatherapi.com" className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                            <p className="text-[10px] text-slate-400 mt-1">和风天气 API Host，格式如 xxxx.re.qweatherapi.com</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">API Key</label>
                            <input type="password" value={settings.weather.qweatherApiKey || ''} onChange={(e) => update('weather', { ...settings.weather, qweatherApiKey: e.target.value })} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">位置 ID</label>
                            <input type="text" value={settings.weather.qweatherLocation || ''} onChange={(e) => update('weather', { ...settings.weather, qweatherLocation: e.target.value })} placeholder="101010100" className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                        </div>
                      )}

                      {settings.weather.provider === 'openweather' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">API Key</label>
                            <input type="password" value={settings.weather.openweatherApiKey || ''} onChange={(e) => update('weather', { ...settings.weather, openweatherApiKey: e.target.value })} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">城市名</label>
                            <input type="text" value={settings.weather.openweatherCity || ''} onChange={(e) => update('weather', { ...settings.weather, openweatherCity: e.target.value })} placeholder="Beijing" className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                        </div>
                      )}

                      {settings.weather.provider === 'visualcrossing' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">API Key</label>
                            <input type="password" value={settings.weather.visualcrossingApiKey || ''} onChange={(e) => update('weather', { ...settings.weather, visualcrossingApiKey: e.target.value })} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">位置</label>
                            <input type="text" value={settings.weather.visualcrossingLocation || ''} onChange={(e) => update('weather', { ...settings.weather, visualcrossingLocation: e.target.value })} placeholder="Beijing,China" className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                        </div>
                      )}

                      {settings.weather.provider === 'accuweather' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">API Key</label>
                            <input type="password" value={settings.weather.accuweatherApiKey || ''} onChange={(e) => update('weather', { ...settings.weather, accuweatherApiKey: e.target.value })} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Location Key</label>
                            <input type="text" value={settings.weather.accuweatherLocationKey || ''} onChange={(e) => update('weather', { ...settings.weather, accuweatherLocationKey: e.target.value })} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">温度单位</label>
                        <select value={settings.weather.unit || 'celsius'} onChange={(e) => update('weather', { ...settings.weather, unit: e.target.value as 'celsius' | 'fahrenheit' })} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                          <option value="celsius">摄氏度 (°C)</option>
                          <option value="fahrenheit">华氏度 (°F)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* AI 配置 */}
              <section className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold dark:text-white mb-3 text-sm flex items-center gap-2">
                  <BookOpen size={16} /> AI 配置
                </h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-500">AI 提供商</label>
                      {settings.ai.provider === 'google' && <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">Google Gemini API</a>}
                      {settings.ai.provider === 'openai' && <a href="https://platform.openai.com/docs/api-reference" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">OpenAI API</a>}
                      {settings.ai.provider === 'claude' && <a href="https://docs.anthropic.com/en/api/getting-started" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">Claude API</a>}
                    </div>
                    <select value={settings.ai.provider} onChange={(e) => {
                      updateAI('provider', e.target.value as any);
                    }} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                      {Object.entries(AI_MODELS).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">API Key</label>
                    <input type="password" value={settings.ai.apiKey || ''} onChange={(e) => updateAI('apiKey', e.target.value)} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Base URL</label>
                    <input type="text" value={settings.ai.baseUrl || ''} onChange={(e) => updateAI('baseUrl', e.target.value)} placeholder={AI_MODELS[settings.ai.provider]?.defaultBaseUrl || ''} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">模型</label>
                    <input type="text" value={settings.ai.model || ''} onChange={(e) => updateAI('model', e.target.value)} placeholder={AI_MODELS[settings.ai.provider]?.defaultModel || ''} className="w-full h-11 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </section>

              {/* 网站内容管理 */}
              {authToken && (
                <section className="pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold dark:text-white mb-3 text-sm flex items-center gap-2">
                    <CloudCog size={16} /> 网站内容管理
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={onImportClick} className="flex flex-col items-center justify-center gap-2 p-3 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg border border-slate-200 dark:border-slate-600 transition-all">
                      <Upload size={18} /><span>导入书签</span>
                    </button>
                    <button onClick={onBackupClick} className="flex flex-col items-center justify-center gap-2 p-3 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg border border-slate-200 dark:border-slate-600 transition-all">
                      <CloudCog size={18} /><span>备份恢复</span>
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">取消</button>
          <button onClick={handleSave} disabled={loading || saving} className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 font-medium">
            {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={16} />}
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
