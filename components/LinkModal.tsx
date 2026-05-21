import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, Pin, Wand2, Trash2 } from 'lucide-react';
import { LinkItem, Category, AIConfig, IconSourceType, IconConfig } from '../types';
import { generateLinkDescription, suggestCategory } from '../services/geminiService';
import { toast } from './Toast';
import { STORAGE_KEYS } from '../src/constants';

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (link: Omit<LinkItem, 'id' | 'createdAt'>) => void;
  onDelete?: (id: string) => void;
  categories: Category[];
  initialData?: LinkItem;
  aiConfig: AIConfig;
  defaultCategoryId?: string;
  iconConfig?: IconConfig;
  supportsUpload?: boolean;
}

const LinkModal: React.FC<LinkModalProps> = ({ isOpen, onClose, onSave, onDelete, categories, initialData, aiConfig, defaultCategoryId, iconConfig, supportsUpload = true }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'common');
  const [pinned, setPinned] = useState(false);
  const [icon, setIcon] = useState('');
  const [iconType, setIconType] = useState<IconSourceType>('google');
  const [isUploading, setIsUploading] = useState(false);

  const [customIconUrl, setCustomIconUrl] = useState('');
  const [edgeoneBlobUrl, setEdgeoneBlobUrl] = useState('');
  const [cloudflareR2Url, setCloudflareR2Url] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetType: 'upload-edgeone' | 'upload-cloudflare') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('图片大小不能超过 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const authToken = localStorage.getItem(STORAGE_KEYS.AUTH_KEY) || localStorage.getItem('authToken') || '';
      const currentCategory = categories.find(c => c.id === categoryId);
      const categoryName = currentCategory ? currentCategory.name : 'common';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('categoryName', categoryName);
      formData.append('platform', targetType === 'upload-cloudflare' ? 'cloudflare' : 'edgeone');

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-auth-password': authToken
        },
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '上传失败');
      }

      const result = await response.json();
      if (result.success && result.url) {
        setIcon(result.url);
        if (targetType === 'upload-edgeone') {
          setEdgeoneBlobUrl(result.url);
        } else {
          setCloudflareR2Url(result.url);
        }
        toast.success('图标上传成功！');
      } else {
        throw new Error('未返回有效的图标地址');
      }
    } catch (err: any) {
      console.error('上传失败:', err);
      toast.error(`上传失败: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConvertUrlToStorage = async (targetPlatform: 'edgeone' | 'cloudflare') => {
    if (!icon || !icon.trim()) {
      toast.error('请先输入有效的图片 URL');
      return;
    }

    if (icon.startsWith('/api/favicon?key=')) {
      toast.info('该图标已经是本地存储图标，无需转换');
      return;
    }

    setIsUploading(true);
    try {
      const authToken = localStorage.getItem(STORAGE_KEYS.AUTH_KEY) || localStorage.getItem('authToken') || '';
      const currentCategory = categories.find(c => c.id === categoryId);
      const categoryName = currentCategory ? currentCategory.name : 'common';

      const formData = new FormData();
      formData.append('url', icon.trim());
      formData.append('categoryName', categoryName);
      formData.append('platform', targetPlatform);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-auth-password': authToken
        },
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '转存失败');
      }

      const result = await response.json();
      if (result.success && result.url) {
        setIcon(result.url);
        if (targetPlatform === 'edgeone') {
          setEdgeoneBlobUrl(result.url);
          setIconType('upload-edgeone');
        } else {
          setCloudflareR2Url(result.url);
          setIconType('upload-cloudflare');
        }
        toast.success(`转存到 ${targetPlatform === 'edgeone' ? 'EdgeOne Blob' : 'Cloudflare R2'} 成功！`);
      } else {
        throw new Error('未返回有效的图标地址');
      }
    } catch (err: any) {
      console.error('转存失败:', err);
      toast.error(`转存失败: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const [customApiUrl, setCustomApiUrl] = useState('');
  const [customApiParam, setCustomApiParam] = useState<'URL' | 'DOMAIN'>('URL');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingIcon, setIsFetchingIcon] = useState(false);
  const [autoFetchIcon, setAutoFetchIcon] = useState(true);
  const [batchMode, setBatchMode] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [weight, setWeight] = useState(0);
  const [pinnedOrder, setPinnedOrder] = useState(0);
  
  // 当不支持上传时，将图标类型降级为默认
  useEffect(() => {
    if (!supportsUpload && (iconType === 'upload-edgeone' || iconType === 'upload-cloudflare')) {
      setIconType('google');
      setIcon('');
    }
  }, [supportsUpload, iconType]);

  // 当模态框关闭时，重置批量模式为默认关闭状态
  useEffect(() => {
    if (!isOpen) {
      setBatchMode(false);
      setShowSuccessMessage(false);
    }
  }, [isOpen]);
  
  // 成功提示1秒后自动消失
  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  // Helper function to get subcategories of a parent category
  const getSubCategories = (parentId: string) => {
    return categories.filter(cat => cat.parentId === parentId);
  };

  // Helper function to check if a category has subcategories
  const hasSubCategories = (categoryId: string) => {
    return getSubCategories(categoryId).length > 0;
  };

  // Helper function to get category display name with parent
  const getCategoryDisplayName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '未知分类';

    if (category.isSubcategory && category.parentId) {
      const parent = categories.find(c => c.id === category.parentId);
      return parent ? `${parent.name} > ${category.name}` : category.name;
    }

    return category.name;
  };

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setUrl(initialData.url);
        setDescription(initialData.description || '');
        setCategoryId(initialData.categoryId);
        setPinned(initialData.pinned || false);
        setIcon(initialData.icon || '');
        setWeight(initialData.weight || 0);
        setPinnedOrder(initialData.pinnedOrder || 0);

        // 智能还原图标获取方式
        let detectedType: IconSourceType = 'google';
        if (initialData.iconType) {
          if (initialData.iconType === 'upload') {
            detectedType = 'upload-edgeone';
          } else {
            detectedType = initialData.iconType as IconSourceType;
          }
        } else {
          if (initialData.icon?.includes('faviconextractor.com')) {
            detectedType = 'faviconextractor';
          } else if (initialData.icon?.includes('google.com/s2/favicons') || initialData.icon?.includes('/api/favicon?domain=')) {
            detectedType = 'google';
          } else if (initialData.icon?.includes('/api/favicon?key=')) {
            detectedType = 'upload-edgeone';
          } else if (initialData.icon) {
            detectedType = 'customurl';
          } else {
            detectedType = 'google';
          }
        }
        setIconType(detectedType);

        // 初始化历史记录状态
        const initialCustom = initialData.customIconUrl || (detectedType === 'customurl' ? initialData.icon : '') || '';
        const initialEdgeone = initialData.edgeoneBlobUrl || (detectedType === 'upload-edgeone' ? initialData.icon : '') || '';
        const initialCloudflare = initialData.cloudflareR2Url || (detectedType === 'upload-cloudflare' ? initialData.icon : '') || '';
        
        setCustomIconUrl(initialCustom);
        setEdgeoneBlobUrl(initialEdgeone);
        setCloudflareR2Url(initialCloudflare);

        if (initialData.iconType === 'customapi' && initialData.iconConfig) {
          setCustomApiUrl((initialData.iconConfig.customApiUrl as string) || '');
          setCustomApiParam((initialData.iconConfig.customApiParam as 'URL' | 'DOMAIN') || 'URL');
        } else {
          setCustomApiUrl('');
          setCustomApiParam('URL');
        }
      } else {
        setTitle('');
        setUrl('');
        setDescription('');
        setWeight(0);
        setPinnedOrder(0);
        // 如果有默认分类ID，使用它；否则使用第一个可用的分类
        if (defaultCategoryId && categories.find(cat => cat.id === defaultCategoryId)) {
          setCategoryId(defaultCategoryId);
        } else {
          // 选择第一个可用的分类
          const firstAvailableCategory = categories.find(cat =>
            !cat.isSubcategory ? !hasSubCategories(cat.id) : true
          );
          setCategoryId(firstAvailableCategory?.id || 'common');
        }
        setPinned(false);
        setIcon('');
        setIconType('google');
        setCustomIconUrl('');
        setEdgeoneBlobUrl('');
        setCloudflareR2Url('');
        setCustomApiUrl('');
        setCustomApiParam('URL');
      }
    }
  }, [isOpen, initialData, categories, defaultCategoryId]);

  // 当URL变化且启用自动获取图标时，自动获取图标
  useEffect(() => {
    if (url && autoFetchIcon && !initialData) {
      const timer = setTimeout(() => {
        handleFetchIcon();
      }, 500); // 延迟500ms执行，避免频繁请求
      
      return () => clearTimeout(timer);
    }
  }, [url, autoFetchIcon, initialData]);

  const handleDelete = () => {
    if (!initialData) return;
    onDelete && onDelete(initialData.id);
    onClose();
  };

  // 缓存自定义图标到KV空间
  const cacheCustomIcon = async (url: string, iconUrl: string) => {
    try {
      // 提取域名
      let domain = url;
      if (domain.startsWith('http://') || domain.startsWith('https://')) {
        const urlObj = new URL(domain);
        domain = urlObj.hostname;
      }
      
      // 将自定义图标保存到KV缓存
      const authToken = localStorage.getItem('authToken');
      if (authToken) {
        await fetch('/api/storage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-password': authToken
          },
          body: JSON.stringify({
            saveConfig: 'favicon',
            domain: domain,
            icon: iconUrl
          })
        });
        console.log(`Custom icon cached for domain: ${domain}`);
      }
    } catch (error) {
      console.log("Failed to cache custom icon", error);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !url) return;
    
    // 确保URL有协议前缀
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      finalUrl = 'https://' + url;
    }
    
    // 保存链接数据
    onSave({
      id: initialData?.id || '',
      title,
      url: finalUrl,
      icon,
      description,
      categoryId,
      pinned,
      weight,
      pinnedOrder,
      iconType,
      iconConfig: iconType === 'customapi' ? { iconType, customApiUrl, customApiParam } : undefined,
      customIconUrl,
      edgeoneBlobUrl,
      cloudflareR2Url
    });
    
    // 如果有自定义图标URL，缓存到KV空间
    if (icon && !icon.startsWith('/api/favicon') && !icon.includes('faviconextractor.com')) {
      cacheCustomIcon(finalUrl, icon);
    }
    
    // 批量模式下不关闭窗口，只显示成功提示
    if (batchMode) {
      setShowSuccessMessage(true);
      // 重置表单，但保留分类和批量模式设置
      setTitle('');
      setUrl('');
      setIcon('');
      setDescription('');
      setPinned(false);
      // 如果开启自动获取图标，尝试获取新图标
      if (autoFetchIcon && finalUrl) {
        handleFetchIcon();
      }
    } else {
      onClose();
    }
  };

  const handleAIAssist = async () => {
    if (!url || !title) return;
    if (!aiConfig.apiKey) {
        toast.warning("请先点击侧边栏左下角设置图标配置 AI API Key");
        return;
    }

    setIsGenerating(true);

    // Parallel execution for speed
    try {
        const descPromise = generateLinkDescription(title, url, aiConfig);

        // 只有在新建链接时才使用AI建议分类，编辑时保持原有分类
        let catPromise = Promise.resolve(null);
        if (!initialData) {
            catPromise = suggestCategory(title, url, categories, aiConfig);
        }

        const [desc, cat] = await Promise.all([descPromise, catPromise]);

        if (desc) setDescription(desc);
        // 只有是新建链接且AI生成了分类建议时，才设置分类
        if (cat && !initialData) {
            setCategoryId(cat);
        }

    } catch (e) {
        console.error("AI Assist failed", e);
    } finally {
        setIsGenerating(false);
    }
  };

  
  const handleFetchIcon = async () => {
    if (!url) return;

    setIsFetchingIcon(true);
    try {
      // 提取域名
      let domain = url;
      // 如果URL没有协议前缀，添加https://作为默认协议
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        domain = 'https://' + url;
      }

      if (domain.startsWith('http://') || domain.startsWith('https://')) {
        const urlObj = new URL(domain);
        domain = urlObj.hostname;
      }

      let iconUrl = '';

      // 根据选择的图标类型生成图标URL
      switch (iconType) {
        case 'faviconextractor':
        case 'google':
          iconUrl = `/api/favicon?domain=${domain}`;
          break;
        default:
          iconUrl = `/api/favicon?domain=${domain}`;
      }

      setIcon(iconUrl);
    } catch (e) {
      console.error("Failed to fetch icon", e);
      toast.error("无法获取图标，请检查URL是否正确");
    } finally {
      setIsFetchingIcon(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold dark:text-white">
              {initialData ? '编辑链接' : '添加新链接'}
            </h3>
            <button
              type="button"
              onClick={() => setPinned(!pinned)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all ${
                pinned 
                ? 'bg-blue-100 border-blue-200 text-blue-600 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300' 
                : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400'
              }`}
              title={pinned ? "取消置顶" : "置顶"}
            >
              <Pin size={14} className={pinned ? "fill-current" : ""} />
              <span className="text-xs font-medium">置顶</span>
            </button>
            {!initialData && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md border bg-slate-50 border-slate-200 dark:bg-slate-700 dark:border-slate-600">
                <input
                  type="checkbox"
                  id="batchMode"
                  checked={batchMode}
                  onChange={(e) => setBatchMode(e.target.checked)}
                  className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-slate-300 rounded dark:border-slate-600 dark:bg-slate-700"
                />
                <label htmlFor="batchMode" className="text-xs font-medium text-slate-500 dark:text-slate-400 cursor-pointer">
                  批量添加不关窗口
                </label>
              </div>
            )}
            {initialData && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all ${
                  'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-400 dark:hover:bg-red-900/30'
                }`}
                title="删除链接"
              >
                <Trash2 size={14} />
                <span className="text-xs font-medium">删除</span>
              </button>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300">标题</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="网站名称"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300">URL 链接</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="example.com 或 https://..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300">图标</label>
            <div className="space-y-2">
              {/* 图标类型选择 */}
              <select
                value={iconType}
                  onChange={(e) => {
                    const newType = e.target.value as IconSourceType;
                    setIconType(newType);
                    // 当切换类型时，从历史记录中还原，而不是变成空白！
                    if (newType === 'customurl') {
                      setIcon(customIconUrl);
                    } else if (newType === 'upload-edgeone') {
                      setIcon(edgeoneBlobUrl);
                    } else if (newType === 'upload-cloudflare') {
                      setIcon(cloudflareR2Url);
                    } else {
                      setIcon('');
                    }
                  }}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="google">Google Favicon API (默认)</option>
                  <option value="faviconextractor">Favicon Extractor</option>
                  <option value="customurl">自定义图片URL</option>
                  <option value="customapi">自定义API</option>
                  {supportsUpload && <option value="upload-edgeone">上传到 Edgeone Pages Blob</option>}
                  {supportsUpload && <option value="upload-cloudflare">上传到 Cloudflare R2</option>}
                </select>

              {/* 图标输入框 - 根据类型显示不同界面 */}
              {iconType === 'customurl' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={icon}
                      onChange={(e) => {
                        setIcon(e.target.value);
                        setCustomIconUrl(e.target.value);
                      }}
                      className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="https://example.com/icon.png"
                    />
                  </div>
                  {supportsUpload && icon && icon.trim() && !icon.startsWith('/api/favicon?key=') && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => handleConvertUrlToStorage('edgeone')}
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {isUploading ? '正在转存...' : '📥 转存到 EdgeOne Blob'}
                      </button>
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => handleConvertUrlToStorage('cloudflare')}
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {isUploading ? '正在转存...' : '📥 转存到 Cloudflare R2'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {iconType === 'customapi' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={customApiUrl}
                      onChange={(e) => setCustomApiUrl(e.target.value)}
                      className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="https://api.example.com/icon"
                    />
                    <select
                      value={customApiParam}
                      onChange={(e) => setCustomApiParam(e.target.value as 'URL' | 'DOMAIN')}
                      className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      <option value="URL">URL参数</option>
                      <option value="DOMAIN">DOMAIN参数</option>
                    </select>
                  </div>
                  {customApiUrl && url && (
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={icon}
                        readOnly
                        className="flex-1 p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 dark:text-slate-400 text-sm"
                        placeholder={`生成的图标地址: ${customApiUrl}?${customApiParam.toLowerCase()}=${customApiParam === 'URL' ? encodeURIComponent(url) : new URL(url).hostname}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const generatedUrl = `${customApiUrl}?${customApiParam.toLowerCase()}=${customApiParam === 'URL' ? encodeURIComponent(url) : new URL(url).hostname}`;
                          setIcon(generatedUrl);
                        }}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 transition-colors text-sm"
                      >
                        生成地址
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(iconType === 'upload-edgeone' || iconType === 'upload-cloudflare') && (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <input
                      type="url"
                      value={icon}
                      readOnly
                      className="flex-1 p-2 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400 text-sm"
                      placeholder="上传图标后将自动生成路径"
                    />
                    <label className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors flex items-center gap-1 font-medium shrink-0">
                      {isUploading ? '正在上传...' : '上传图标'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, iconType as 'upload-edgeone' | 'upload-cloudflare')}
                        disabled={isUploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {icon && (
                    <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                      <img src={icon} alt="Preview" className="w-8 h-8 object-contain rounded" />
                      <span className="text-xs text-slate-500 truncate">{icon}</span>
                    </div>
                  )}
                </div>
              )}

              {(iconType === 'faviconextractor' || iconType === 'google') && (
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="留空自动获取图标"
                  />
                  <button
                    type="button"
                    onClick={handleFetchIcon}
                    disabled={!url || isFetchingIcon}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-1 transition-colors"
                  >
                    {isFetchingIcon ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    获取图标
                  </button>
                </div>
              )}

                </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="autoFetchIcon"
                checked={autoFetchIcon}
                onChange={(e) => setAutoFetchIcon(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded dark:border-slate-600 dark:bg-slate-700"
              />
              <label htmlFor="autoFetchIcon" className="text-sm text-slate-700 dark:text-slate-300">
                自动获取URL链接的图标
              </label>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium dark:text-slate-300">描述 (选填)</label>
                {(title && url) && (
                    <button
                        type="button"
                        onClick={handleAIAssist}
                        disabled={isGenerating}
                        className="text-xs flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                    >
                        {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        AI 自动填写
                    </button>
                )}
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all h-20 resize-none"
              placeholder="简短描述..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300">分类</label>
            <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
            {categories
                .filter(cat => !cat.isSubcategory ? !hasSubCategories(cat.id) : true)
                .map(cat => (
                    <option key={cat.id} value={cat.id}>
                        {cat.isSubcategory ? `└ ${getCategoryDisplayName(cat.id)}` : cat.name}
                    </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300">权重 (Weight)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(parseInt(e.target.value) || 0)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="数值越小越靠前"
            />
            <p className="text-[10px] text-slate-400 mt-1">控制在分类中的排序，数值越小越靠前。</p>
          </div>

          {pinned && (
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-slate-300">置顶权重 (Pinned Order)</label>
              <input
                type="number"
                value={pinnedOrder}
                onChange={(e) => setPinnedOrder(parseInt(e.target.value) || 0)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="数值越小越靠前"
              />
              <p className="text-[10px] text-slate-400 mt-1">控制在置顶区域的排序，数值越小越靠前。</p>
            </div>
          )}

          <div className="pt-2 relative">
            {/* 成功提示 */}
            {showSuccessMessage && (
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg transition-opacity duration-300">
                添加成功
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg shadow-blue-500/30"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LinkModal;
