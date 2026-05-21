import React, { useState, useEffect, useRef } from 'react';
import { X, Cloud, Download, Upload, CheckCircle2, AlertCircle, RefreshCw, Save, FolderUp } from 'lucide-react';
import { Category, LinkItem, WebDavConfig, SearchConfig, AIConfig } from '../types';
import { checkWebDavConnection, uploadBackup, downloadBackup } from '../services/webDavService';
import { generateBookmarkHtml, downloadHtmlFile } from '../services/exportService';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  links: LinkItem[];
  categories: Category[];
  onRestore: (links: LinkItem[], categories: Category[]) => void;
  webDavConfig: WebDavConfig;
  onSaveWebDavConfig: (config: WebDavConfig) => void;
  searchConfig: SearchConfig;
  onRestoreSearchConfig: (searchConfig: SearchConfig) => void;
  aiConfig: AIConfig;
  onRestoreAIConfig: (aiConfig: AIConfig) => void;
}

const BackupModal: React.FC<BackupModalProps> = ({ 
  isOpen, onClose, links, categories, onRestore, webDavConfig, onSaveWebDavConfig, searchConfig, onRestoreSearchConfig, aiConfig, onRestoreAIConfig 
}) => {
  const [config, setConfig] = useState<WebDavConfig>(webDavConfig);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'uploading' | 'downloading' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMsg, setImportMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if(isOpen) {
        setConfig(webDavConfig);
        setTestResult(null);
        setSyncStatus('idle');
        setImportStatus('idle');
        setImportMsg('');
    }
  }, [isOpen, webDavConfig]);

  const fetchIconsAsBase64 = async (linksList: LinkItem[], onProgress?: (current: number, total: number) => void) => {
    const uploadedIcons: Array<{ key: string, platform: 'edgeone' | 'cloudflare', data: string }> = [];
    
    const iconUrls = new Set<string>();
    linksList.forEach(l => {
      if (l.edgeoneBlobUrl && l.edgeoneBlobUrl.startsWith('/api/favicon?key=')) {
        iconUrls.add(l.edgeoneBlobUrl);
      }
      if (l.cloudflareR2Url && l.cloudflareR2Url.startsWith('/api/favicon?key=')) {
        iconUrls.add(l.cloudflareR2Url);
      }
      if (l.icon && l.icon.startsWith('/api/favicon?key=')) {
        iconUrls.add(l.icon);
      }
    });

    const total = iconUrls.size;
    let current = 0;

    for (const iconUrl of iconUrls) {
      current++;
      if (onProgress) onProgress(current, total);
      
      try {
        const urlObj = new URL(iconUrl, window.location.origin);
        const key = urlObj.searchParams.get('key');
        if (!key) continue;

        const res = await fetch(iconUrl);
        if (!res.ok) continue;

        const blob = await res.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        let platform: 'edgeone' | 'cloudflare' = 'edgeone';
        const matchingLink = linksList.find(l => l.cloudflareR2Url === iconUrl || (l.icon === iconUrl && l.iconType === 'upload-cloudflare'));
        if (matchingLink) {
          platform = 'cloudflare';
        }

        uploadedIcons.push({
          key,
          platform,
          data: base64
        });
      } catch (e) {
        console.error(`Failed to export icon: ${iconUrl}`, e);
      }
    }

    return uploadedIcons;
  };

  const restoreUploadedIcons = async (
    uploadedIcons: Array<{ key: string, platform: 'edgeone' | 'cloudflare', data: string }>,
    linksList: LinkItem[],
    onProgress?: (current: number, total: number) => void
  ) => {
    const updatedLinks = [...linksList];
    const total = uploadedIcons.length;
    let current = 0;

    const authToken = localStorage.getItem('cloudnav_auth_token') || localStorage.getItem('authToken') || '';

    for (const icon of uploadedIcons) {
      current++;
      if (onProgress) onProgress(current, total);

      try {
        const res = await fetch(icon.data);
        const blob = await res.blob();
        const filename = icon.key.split('/').pop() || 'icon.png';
        const file = new File([blob], filename, { type: blob.type });

        const categoryName = icon.key.split('/')[0] || 'common';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('categoryName', categoryName);
        formData.append('platform', icon.platform);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'x-auth-password': authToken
          },
          body: formData
        });

        if (uploadRes.ok) {
          const result = await uploadRes.json();
          if (result.success && result.url) {
            const oldUrl = `/api/favicon?key=${icon.key}`;
            const newUrl = result.url;

            updatedLinks.forEach(l => {
              if (l.icon === oldUrl) l.icon = newUrl;
              if (l.edgeoneBlobUrl === oldUrl) l.edgeoneBlobUrl = newUrl;
              if (l.cloudflareR2Url === oldUrl) l.cloudflareR2Url = newUrl;
            });
          }
        }
      } catch (e) {
        console.error(`Failed to restore icon: ${icon.key}`, e);
      }
    }

    return updatedLinks;
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const success = await checkWebDavConnection(config);
    setTestResult(success ? 'success' : 'fail');
    setIsTesting(false);
  };

  const handleSaveConfig = () => {
    onSaveWebDavConfig(config);
    // Automatically test upon save if enabled
    if (config.enabled) {
        handleTestConnection();
    }
  };

  const handleBackupToCloud = async () => {
    setSyncStatus('uploading');
    setStatusMsg('正在打包本地图标并上传...');
    const uploadedIcons = await fetchIconsAsBase64(links, (curr, tot) => {
      setStatusMsg(`正在打包本地图标 (${curr}/${tot})...`);
    });
    setStatusMsg('正在上传到云端...');
    const success = await uploadBackup(config, { links, categories, searchConfig, aiConfig, uploadedIcons });
    if (success) {
        setSyncStatus('success');
        setStatusMsg('备份成功！');
    } else {
        setSyncStatus('error');
        setStatusMsg('上传失败，请检查配置或网络。');
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!confirm("确定要从 WebDAV 恢复吗？这将覆盖当前的本地数据。")) return;
    
    setSyncStatus('downloading');
    setStatusMsg('正在下载...');
    const data = await downloadBackup(config);
    
    if (data) {
        let finalLinks = data.links;
        if (data.uploadedIcons && Array.isArray(data.uploadedIcons) && data.uploadedIcons.length > 0) {
            setStatusMsg('正在还原云端图标文件...');
            finalLinks = await restoreUploadedIcons(data.uploadedIcons, data.links, (curr, tot) => {
                setStatusMsg(`正在还原图标 (${curr}/${tot})...`);
            });
        }
        onRestore(finalLinks, data.categories);
        // 恢复搜索配置（如果存在）
        if (data.searchConfig) {
            onRestoreSearchConfig(data.searchConfig);
        }
        // 恢复AI配置（如果存在）
        if (data.aiConfig) {
            onRestoreAIConfig(data.aiConfig);
        }
        setSyncStatus('success');
        setStatusMsg('恢复成功！');
    } else {
        setSyncStatus('error');
        setStatusMsg('下载失败或文件格式错误。');
    }
  };

  const handleExportHtml = () => {
    const html = generateBookmarkHtml(links, categories);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadHtmlFile(html, `bookmarks_${dateStr}.html`);
  };

  const handleExportJson = async () => {
    setImportStatus('idle');
    setImportMsg('正在读取并打包本地图标...');
    
    const uploadedIcons = await fetchIconsAsBase64(links, (curr, tot) => {
      setImportMsg(`正在读取本地图标 (${curr}/${tot})...`);
    });

    // 也获取 config key 以备份所有设置
    let appConfig = null;
    try {
      const res = await fetch('/api/storage?key=config');
      if (res.ok) {
        const data = await res.json();
        if (data.value) appConfig = JSON.parse(data.value);
      }
    } catch (e) { /* ignore */ }

    const data = { links, categories, searchConfig, aiConfig, config: appConfig, uploadedIcons };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cloudnav_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setImportStatus('success');
    setImportMsg('本地备份导出成功，已包含所有自定义图标文件！');
  };

  const handleImportJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);

        // 验证备份文件基本结构
        if (!Array.isArray(data.links) || !Array.isArray(data.categories)) {
          setImportStatus('error');
          setImportMsg('无效的备份文件：缺少 links 或 categories 数据。');
          return;
        }

        if (!confirm(
          `确定要导入备份吗？\n\n` +
          `将导入 ${data.links.length} 个链接和 ${data.categories.length} 个分类。\n\n` +
          `⚠️ 这将覆盖当前的所有本地数据。`
        )) {
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        setImportStatus('idle');
        setImportMsg('正在准备导入...');
        
        let finalLinks = data.links;
        if (data.uploadedIcons && Array.isArray(data.uploadedIcons) && data.uploadedIcons.length > 0) {
          setImportMsg('正在导入并还原本地图标...');
          finalLinks = await restoreUploadedIcons(data.uploadedIcons, data.links, (curr, tot) => {
            setImportMsg(`正在还原图标 (${curr}/${tot})...`);
          });
        }

        // 恢复链接和分类
        onRestore(finalLinks, data.categories);

        // 恢复搜索配置
        if (data.searchConfig) {
          onRestoreSearchConfig(data.searchConfig);
        }

        // 恢复 AI 配置
        if (data.aiConfig) {
          onRestoreAIConfig(data.aiConfig);
        }

        setImportStatus('success');
        setImportMsg(`导入成功！已恢复 ${data.links.length} 个链接、${data.categories.length} 个分类以及关联的自定义图标。`);
      } catch (err) {
        setImportStatus('error');
        setImportMsg('解析备份文件失败，请确认文件格式正确。');
      }

      // 重置 file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold dark:text-white flex items-center gap-2">
            <Cloud className="text-blue-500" /> 备份与恢复
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* Section 1: WebDAV Configuration */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-800 dark:text-slate-200">WebDAV 设置 (坚果云/<a href="https://infini-cloud.net/en/modules/mypage/usage/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 underline">InfiniCloud</a>等)</h4>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={config.enabled}
                            onChange={(e) => setConfig({...config, enabled: e.target.checked})}
                            className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-400">启用 WebDAV</span>
                    </label>
                </div>

                <div className={`space-y-3 transition-opacity ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">服务器地址 (URL)</label>
                        <input 
                            type="text" 
                            value={config.url}
                            onChange={(e) => setConfig({...config, url: e.target.value})}
                            placeholder="https://dav.jianguoyun.com/dav/"
                            className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">用户名</label>
                            <input 
                                type="text" 
                                value={config.username}
                                onChange={(e) => setConfig({...config, username: e.target.value})}
                                className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">应用密码</label>
                            <input 
                                type="password" 
                                value={config.password}
                                onChange={(e) => setConfig({...config, password: e.target.value})}
                                className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 pt-2">
                        <button 
                            onClick={handleTestConnection}
                            disabled={isTesting}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors"
                        >
                            {isTesting ? '连接中...' : '测试连接'}
                        </button>
                        <button 
                            onClick={handleSaveConfig}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors flex items-center gap-1"
                        >
                            <Save size={12} /> 保存配置
                        </button>
                        {testResult === 'success' && <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 size={12}/> 连接成功</span>}
                        {testResult === 'fail' && <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12}/> 连接失败</span>}
                    </div>
                </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-700" />

            {/* Section 2: Sync Actions */}
            <section className="space-y-4">
                <h4 className="font-medium text-slate-800 dark:text-slate-200">云端同步操作</h4>
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={handleBackupToCloud}
                        disabled={!config.enabled}
                        className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <Upload className="w-8 h-8 text-blue-500 mb-2 group-hover:-translate-y-1 transition-transform" />
                        <span className="text-sm font-medium dark:text-white">上传备份到 WebDAV</span>
                        <span className="text-xs text-slate-500 mt-1">覆盖云端数据</span>
                    </button>

                    <button 
                        onClick={handleRestoreFromCloud}
                        disabled={!config.enabled}
                        className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <Download className="w-8 h-8 text-purple-500 mb-2 group-hover:-translate-y-1 transition-transform" />
                        <span className="text-sm font-medium dark:text-white">从 WebDAV 恢复</span>
                        <span className="text-xs text-slate-500 mt-1">覆盖本地数据</span>
                    </button>
                </div>
                
                {syncStatus !== 'idle' && (
                    <div className={`text-sm text-center p-2 rounded ${
                        syncStatus === 'success' ? 'bg-green-50 text-green-600 dark:bg-green-900/20' : 
                        syncStatus === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 
                        'bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                    }`}>
                        {statusMsg}
                    </div>
                )}
            </section>

            <hr className="border-slate-200 dark:border-slate-700" />

             {/* Section 3: Local Export & Import */}
             <section className="space-y-4">
                <h4 className="font-medium text-slate-800 dark:text-slate-200">本地导出与恢复</h4>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 flex items-center justify-between">
                    <div>
                        <h5 className="text-sm font-medium dark:text-slate-200">导出 HTML 书签文件</h5>
                        <p className="text-xs text-slate-500 mt-1">兼容 Chrome, Edge, Firefox 导入格式，保留目录结构</p>
                    </div>
                    <button 
                        onClick={handleExportHtml}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-blue-500 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Download size={16} /> 导出 HTML
                    </button>
                </div>
                
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 flex items-center justify-between">
                    <div>
                        <h5 className="text-sm font-medium dark:text-slate-200">导出 cloudnav_backup.json 文件</h5>
                        <p className="text-xs text-slate-500 mt-1">与 WebDAV 备份格式一致，便于数据迁移</p>
                    </div>
                    <button 
                        onClick={handleExportJson}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-blue-500 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Download size={16} /> 导出 JSON
                    </button>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                    <div>
                        <h5 className="text-sm font-medium dark:text-slate-200">导入 cloudnav_backup.json 恢复</h5>
                        <p className="text-xs text-slate-500 mt-1">从本地 JSON 备份文件恢复所有数据（链接、分类、搜索和 AI 配置）</p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleImportJson}
                        className="hidden"
                        id="import-json-input"
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
                    >
                        <FolderUp size={16} /> 导入 JSON
                    </button>
                </div>

                {importStatus !== 'idle' && (
                    <div className={`text-sm text-center p-2 rounded ${
                        importStatus === 'success' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 
                        'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                        {importMsg}
                    </div>
                )}
             </section>

        </div>
      </div>
    </div>
  );
};

export default BackupModal;