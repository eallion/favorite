import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, ArrowRight, Check, AlertCircle, FolderInput, ListTree, Database } from 'lucide-react';
import { Category, LinkItem, SearchConfig, AIConfig } from '../types';
import { parseBookmarks } from '../services/bookmarkParser';
import { toast } from './Toast';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingLinks: LinkItem[];
  categories: Category[];
  onImport: (newLinks: LinkItem[], newCategories: Category[]) => void;
  onImportSearchConfig?: (searchConfig: SearchConfig) => void;
  onImportAIConfig?: (aiConfig: AIConfig) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ 
  isOpen, 
  onClose, 
  existingLinks, 
  categories, 
  onImport,
  onImportSearchConfig,
  onImportAIConfig
}) => {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingMsg, setAnalyzingMsg] = useState('正在分析文件...');

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
  
  // Analysis Results
  const [newLinksCount, setNewLinksCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [newCategoriesCount, setNewCategoriesCount] = useState(0);

  // Staging Data
  const [parsedLinks, setParsedLinks] = useState<LinkItem[]>([]);
  const [parsedCategories, setParsedCategories] = useState<Category[]>([]);
  const [parsedSearchConfig, setParsedSearchConfig] = useState<SearchConfig | null>(null);
  const [parsedAIConfig, setParsedAIConfig] = useState<AIConfig | null>(null);

  // Duplicate Links Handling
  const [duplicateLinks, setDuplicateLinks] = useState<Array<{ newLink: LinkItem; existingLink: LinkItem }>>([]);
  const [duplicateHandlingMode, setDuplicateHandlingMode] = useState<'skip' | 'overwrite' | 'add' | 'merge'>('skip');
  
  // Options
  const [importMode, setImportMode] = useState<'original' | 'merge'>('original');
  const [targetCategoryId, setTargetCategoryId] = useState<string>(() => {
    // 优先选择没有子分类的顶级分类，否则选择第一个子分类或 common
    const topLevelWithoutChildren = categories.find(c =>
        !c.isSubcategory && !c.parentId && getSubCategories(c.id).length === 0
    );
    if (topLevelWithoutChildren) return topLevelWithoutChildren.id;

    const firstSubCategory = categories.find(c => c.isSubcategory);
    return firstSubCategory?.id || 'common';
});
  const [importType, setImportType] = useState<'html' | 'json' | 'links'>('html');
  const [showSubCategories, setShowSubCategories] = useState<boolean>(true);

  // 当importType变化时，自动调整importMode
  useEffect(() => {
    if (importType === 'links') {
      // 对于链接导入，默认使用merge模式，允许选择目录
      setImportMode('merge');
    }
  }, [importType]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const linksFileInputRef = useRef<HTMLInputElement>(null);

  // 获取顶级分类
  const getTopLevelCategories = () => {
    return categories.filter(cat => !cat.isSubcategory && !cat.parentId);
  };

  // 获取指定顶级分类的子分类
  const getSubCategories = (parentId: string) => {
    return categories.filter(cat => cat.parentId === parentId);
  };

  // 获取分类的显示名称
  const getCategoryDisplayName = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '未知分类';

    if (category.isSubcategory && category.parentId) {
      const parent = categories.find(c => c.id === category.parentId);
      return parent ? `${parent.name} > ${category.name}` : category.name;
    }

    return category.name;
  };

  // Parse JSON backup file
  const parseJsonBackup = async (file: File): Promise<{ links: LinkItem[], categories: Category[], searchConfig?: SearchConfig, aiConfig?: AIConfig }> => {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate the structure
    if (!data.links || !Array.isArray(data.links) || !data.categories || !Array.isArray(data.categories)) {
      throw new Error('Invalid backup file format');
    }

    return {
      links: data.links,
      categories: data.categories,
      searchConfig: data.searchConfig,
      aiConfig: data.aiConfig
    };
  };

  // Parse links-only JSON file
  const parseLinksJson = async (file: File): Promise<{ links: LinkItem[] }> => {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate the structure - only need links array
    if (!data.links || !Array.isArray(data.links)) {
      throw new Error('无效的链接文件格式，文件必须包含 links 数组');
    }

    // Process and validate links
    const processedLinks: LinkItem[] = data.links.map((link: any, index: number) => {
      // URL is required
      if (!link.url || typeof link.url !== 'string') {
        throw new Error(`第 ${index + 1} 个链接缺少有效的 URL`);
      }

      // Validate categoryId if provided
      if (link.categoryId && typeof link.categoryId !== 'string') {
        console.warn(`链接 ${link.title || link.url} 的 categoryId 无效，将使用默认分类`);
        link.categoryId = 'common';
      }

      // Smart icon detection and configuration
      let iconUrl = link.icon;
      let detectedIconType: 'faviconextractor' | 'google' | 'customurl' | 'customapi' | 'upload' = 'google';
      let iconConfig: any = undefined;

      // Fallback to default if no icon is provided
      if (!iconUrl) {
        const domain = new URL(link.url).hostname;
        iconUrl = `/api/favicon?domain=${domain}`;
        detectedIconType = 'google';
      } else {
        // Detect icon type from URL pattern
        if (iconUrl.startsWith('/api/favicon?key=')) {
          detectedIconType = 'upload';
        } else if (iconUrl.startsWith('/api/favicon') || iconUrl.includes('google.com/s2/favicons') || iconUrl.includes('gstatic.com')) {
          detectedIconType = 'google';
          try {
            const domain = new URL(link.url).hostname;
            iconUrl = `/api/favicon?domain=${domain}`;
          } catch (e) {}
        } else if (iconUrl.includes('faviconextractor.com')) {
          detectedIconType = 'faviconextractor';
          try {
            const domain = new URL(link.url).hostname;
            iconUrl = `/api/favicon?domain=${domain}`;
          } catch (e) {}
        } else if (iconUrl.includes('?') && (iconUrl.includes('url=') || iconUrl.includes('domain=') || iconUrl.includes('URL=') || iconUrl.includes('DOMAIN='))) {
          // Detect custom API pattern - has query parameters with url/domain
          detectedIconType = 'customapi';

          // Extract API base URL and parameter type for iconConfig
          const urlObj = new URL(iconUrl);
          const searchParams = urlObj.searchParams;

          let paramType: 'URL' | 'DOMAIN' = 'URL';
          let baseUrl = iconUrl.split('?')[0];

          if (searchParams.has('url') || searchParams.has('URL')) {
            paramType = 'URL';
          } else if (searchParams.has('domain') || searchParams.has('DOMAIN')) {
            paramType = 'DOMAIN';
          }

          iconConfig = {
            iconType: 'customapi',
            customApiUrl: baseUrl,
            customApiParam: paramType
          };
        } else {
          // Default to customurl for other patterns
          detectedIconType = 'customurl';
          iconConfig = {
            iconType: 'customurl',
            customUrl: iconUrl
          };
        }
      }

      // Generate a complete LinkItem object with detected icon type information
      const linkItem: any = {
        id: link.id || Date.now().toString() + index,
        title: link.title || link.url,
        url: link.url,
        icon: iconUrl,
        description: link.description || '',
        categoryId: link.categoryId || 'common',
        pinned: link.pinned || false,
        createdAt: link.createdAt || Date.now(),
        order: link.order || 0,
      };

      // Store icon type and configuration for customurl and customapi types
      // This allows the LinkModal to recognize and edit the icon type later
      if (detectedIconType === 'customurl' || detectedIconType === 'customapi') {
        linkItem.iconType = detectedIconType;
        linkItem.iconConfig = iconConfig;
      }

      return linkItem;
    });

    return { links: processedLinks };
  };

  // Download links template
  const downloadLinksTemplate = () => {
    const template = {
      links: [
        {
          title: "示例网站",
          url: "https://example.com",
          description: "这是使用默认图标的示例网站（无图标字段，将自动生成）",
          categoryId: "common",
          pinned: false
        },
        {
          title: "GitHub",
          url: "https://github.com",
          description: "代码托管平台 - 使用 Google Favicon API",
          icon: "https://www.google.com/s2/favicons?domain=github.com&sz=64",
          categoryId: "common",
          pinned: true
        },
        {
          title: "Favicon Extractor 示例",
          url: "https://react.dev",
          description: "使用 Favicon Extractor 的示例",
          icon: "https://www.faviconextractor.com/favicon/react.dev?larger=true",
          categoryId: "dev",
          pinned: false
        },
        {
          title: "技术博客",
          url: "https://techblog.example.com",
          description: "使用自定义图片 URL 的示例",
          icon: "https://example.com/icons/blog.png",
          pinned: false
        },
        {
          title: "API 服务 - DOMAIN 参数",
          url: "https://api.example.com",
          description: "使用自定义 API 的示例，检测为 DOMAIN 参数",
          icon: "https://api.example.com/icon?domain=api.example.com",
          categoryId: "common",
          pinned: false
        },
        {
          title: "设计资源 - URL 参数",
          url: "https://design.example.com",
          description: "使用 URL 参数的自定义 API 示例",
          icon: "https://icons.example.com/get?url=https://design.example.com",
          categoryId: "design",
          pinned: false
        },
        {
          title: "另一个 API 示例",
          url: "https://tools.example.com",
          description: "自定义 API 示例 - 参数名大小写不敏感",
          icon: "https://custom-icons.com/api?URL=https://tools.example.com",
          categoryId: "dev",
          pinned: false
        }
      ]
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cloudnav_links_template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.info('链接模板已下载');
  };

  if (!isOpen) return null;

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setParsedLinks([]);
    setParsedCategories([]);
    setParsedSearchConfig(null);
    setParsedAIConfig(null);
    setNewLinksCount(0);
    setDuplicateCount(0);
    setNewCategoriesCount(0);
    setImportType('html');
    setShowSubCategories(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'html' | 'json' | 'links') => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setAnalyzing(true);
    setImportType(type);

    try {
        let result: { links: LinkItem[], categories: Category[], searchConfig?: SearchConfig, aiConfig?: AIConfig };

        if (type === 'html') {
            setAnalyzingMsg('正在解析 HTML 书签...');
            result = await parseBookmarks(selectedFile);
        } else if (type === 'links') {
            setAnalyzingMsg('正在解析 JSON 链接...');
            const linksResult = await parseLinksJson(selectedFile);
            result = {
                links: linksResult.links,
                categories: [], // Links-only import doesn't include categories
                searchConfig: undefined,
                aiConfig: undefined
            };
        } else {
            setAnalyzingMsg('正在解析 JSON 备份文件...');
            const text = await selectedFile.text();
            const data = JSON.parse(text);

            if (!data.links || !Array.isArray(data.links) || !data.categories || !Array.isArray(data.categories)) {
              throw new Error('Invalid backup file format');
            }

            let finalLinks = data.links;
            if (data.uploadedIcons && Array.isArray(data.uploadedIcons) && data.uploadedIcons.length > 0) {
              setAnalyzingMsg('正在导入并还原备份图标...');
              finalLinks = await restoreUploadedIcons(data.uploadedIcons, data.links, (curr, tot) => {
                setAnalyzingMsg(`正在还原图标 (${curr}/${tot})...`);
              });
            }

            result = {
              links: finalLinks,
              categories: data.categories,
              searchConfig: data.searchConfig,
              aiConfig: data.aiConfig
            };
        }
        
        // 2. Diff Logic - Enhanced with duplicate handling
        const existingUrls = new Map<string, LinkItem>();
        existingLinks.forEach((link: LinkItem) => {
            const normalizedUrl = link.url.trim().replace(/\/$/, '');
            existingUrls.set(normalizedUrl, link);
        });

        const uniqueNewLinks: LinkItem[] = [];
        const foundDuplicateLinks: Array<{ newLink: LinkItem; existingLink: LinkItem }> = [];
        let duplicates = 0;

        result.links.forEach((link: LinkItem) => {
            const normalizedUrl = link.url.trim().replace(/\/$/, '');
            const existingLink = existingUrls.get(normalizedUrl);

            if (existingLink) {
                // Found duplicate, collect it for user decision
                duplicates++;
                foundDuplicateLinks.push({
                    newLink: link,
                    existingLink: existingLink
                });
            } else {
                uniqueNewLinks.push(link);
            }
        });

        // 3. Category Diff
        const existingCategoryNames = new Set(categories.map(c => c.name));
        const uniqueNewCategories = result.categories.filter(c => !existingCategoryNames.has(c.name));

        setParsedLinks(uniqueNewLinks);
        setParsedCategories(uniqueNewCategories);
        setParsedSearchConfig(result.searchConfig || null);
        setParsedAIConfig(result.aiConfig || null);
        setNewLinksCount(uniqueNewLinks.length);
        setDuplicateCount(duplicates);
        setNewCategoriesCount(uniqueNewCategories.length);
        setDuplicateLinks(foundDuplicateLinks);
        
        setStep('preview');
    } catch (error) {
        let errorMessage;
        if (type === 'html') {
            errorMessage = "解析文件失败，请确保是标准的 Chrome HTML 书签文件。";
        } else if (type === 'links') {
            errorMessage = "解析文件失败，请确保是有效的链接 JSON 文件。";
        } else {
            errorMessage = "解析文件失败，请确保是有效的 cloudnav_backup.json 文件。";
        }
        toast.error(errorMessage);
        console.error(error);
    } finally {
        setAnalyzing(false);
    }
  };

  const executeImport = () => {
      let finalLinks = [...parsedLinks];
      let finalCategories: Category[] = [];

      // Handle duplicate links based on the selected mode
      duplicateLinks.forEach(({ newLink, existingLink }: { newLink: LinkItem; existingLink: LinkItem }) => {
          switch (duplicateHandlingMode) {
              case 'skip':
                  // Skip duplicates - do nothing
                  break;
              case 'overwrite':
                  // Overwrite existing link with new data
                  const overwriteLink: LinkItem = {
                      id: existingLink.id,
                      title: newLink.title || existingLink.title,
                      url: existingLink.url, // Keep existing URL as it's the same
                      icon: newLink.icon || existingLink.icon || '',
                      description: newLink.description || existingLink.description || '',
                      categoryId: newLink.categoryId || existingLink.categoryId,
                      pinned: newLink.pinned !== undefined ? newLink.pinned : (existingLink.pinned || false),
                      createdAt: newLink.createdAt || existingLink.createdAt,
                      ...(existingLink.pinnedOrder !== undefined && { pinnedOrder: existingLink.pinnedOrder })
                  };
                  finalLinks.push(overwriteLink);
                  break;
              case 'add':
                  // Add duplicate as a new link with slightly modified title
                  const duplicateAsNew: LinkItem = {
                      id: `${newLink.id}_duplicate_${Date.now()}`,
                      title: newLink.title.includes(' (副本)') ? newLink.title : `${newLink.title} (副本)`,
                      url: newLink.url,
                      icon: newLink.icon || '',
                      description: newLink.description || '',
                      categoryId: newLink.categoryId,
                      pinned: newLink.pinned || false,
                      createdAt: Date.now(),
                      ...(newLink.pinnedOrder !== undefined && { pinnedOrder: newLink.pinnedOrder })
                  };
                  finalLinks.push(duplicateAsNew);
                  break;
              case 'merge':
                  // Merge data - prefer new data but keep existing when new is empty
                  const mergedLink: LinkItem = {
                      id: existingLink.id,
                      title: newLink.title || existingLink.title,
                      url: existingLink.url, // Keep existing URL as it's the same
                      icon: newLink.icon || existingLink.icon || '',
                      description: newLink.description || existingLink.description || '',
                      categoryId: newLink.categoryId || existingLink.categoryId,
                      pinned: newLink.pinned !== undefined ? newLink.pinned : (existingLink.pinned || false),
                      createdAt: newLink.createdAt || existingLink.createdAt,
                      ...(existingLink.pinnedOrder !== undefined && { pinnedOrder: existingLink.pinnedOrder })
                  };
                  finalLinks.push(mergedLink);
                  break;
          }
      });

      if (importMode === 'merge') {
          // Flatten all new links to the target category
          finalLinks = finalLinks.map(link => ({
              ...link,
              categoryId: targetCategoryId
          }));
          // In merge mode, we do NOT add new categories from the file
          finalCategories = []; 
      } else {
          // Keep structure mode
          // We need to merge categories carefully.
          // Since parseBookmarks generates IDs for categories, if a category name already exists in `categories`, 
          // we should remap the links to the existing category ID instead of creating a new duplicate-named category.
          
          const nameToIdMap = new Map<string, string>();
          categories.forEach(c => nameToIdMap.set(c.name, c.id));

          // Valid new categories to add
          const categoriesToAdd: Category[] = [];
          
          // First pass: Resolve IDs for all categories
          // If a category name matches an existing one, map imported ID to existing ID.
          // If it's new, map imported ID to imported ID (no change).
          const idMap = new Map<string, string>();

          parsedCategories.forEach(pc => {
             if (nameToIdMap.has(pc.name)) {
                 // Map old ID -> Existing ID
                 idMap.set(pc.id, nameToIdMap.get(pc.name)!);
             } else {
                 // It's a new category
                 categoriesToAdd.push(pc);
                 // Map old ID -> Old ID (it's consistent since we're adding the raw category)
                 idMap.set(pc.id, pc.id);
                 
                 // Also add to name map for subsequent lookups
                 nameToIdMap.set(pc.name, pc.id);
             }
          });

          // Second pass: Update parentIds for new categories ensuring they point to valid IDs
          // We only need to fix parentIds for categories we are ADDING.
          // Existing categories don't change.
          const finalCategoriesToAdd = categoriesToAdd.map(cat => {
              if (cat.parentId && idMap.has(cat.parentId)) {
                  // Update parentId to the potentially remapped ID
                  return { ...cat, parentId: idMap.get(cat.parentId) };
              }
              return cat;
          });

          // Remap links
          finalLinks = finalLinks.map(link => {
             // Find the ID the link *should* point to
             // We can just use the idMap directly if the link's categoryId is in it.
             // If not, it might be an existing category ID that wasn't in the imported file.
             
             if (idMap.has(link.categoryId)) {
                 return { ...link, categoryId: idMap.get(link.categoryId)! };
             }
             
             // If the link points to a category that wasn't in the import file, AND it exists in current categories
             const existingCat = categories.find(c => c.id === link.categoryId);
             if (existingCat) {
                 return link; // It's fine
             }

             // Fallback
             return { ...link, categoryId: 'common' };
          });

          finalCategories = finalCategoriesToAdd;
      }

      onImport(finalLinks, finalCategories);
      
      // Import search config if available
      if (parsedSearchConfig && onImportSearchConfig) {
          onImportSearchConfig(parsedSearchConfig);
      }
      
      // Import AI config if available
      if (parsedAIConfig && onImportAIConfig) {
          onImportAIConfig(parsedAIConfig);
      }
      
      handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-semibold dark:text-white flex items-center gap-2">
            <Upload size={20} className="text-blue-500"/> 导入书签
          </h3>
          <button onClick={handleClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
            
            {step === 'upload' && (
                <div className="space-y-4">
                    {/* HTML Import Option */}
                    <div className="flex flex-col items-center justify-center space-y-4 py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                         onClick={() => fileInputRef.current?.click()}>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".html" 
                            onChange={(e) => handleFileChange(e, 'html')} 
                        />
                        
                        {analyzing && importType === 'html' ? (
                            <div className="flex flex-col items-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-2"></div>
                                <span className="text-slate-500">{analyzingMsg}</span>
                            </div>
                        ) : (
                            <>
                                <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                                    <FileText size={32} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium dark:text-white">点击选择 HTML 文件</p>
                                    <p className="text-xs text-slate-500 mt-1">支持 Chrome, Edge, Firefox 导出的书签</p>
                                </div>
                            </>
                        )}
                    </div>
                    
                    {/* JSON Import Option */}
                    <div className="flex flex-col items-center justify-center space-y-4 py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                         onClick={() => jsonFileInputRef.current?.click()}>
                        <input 
                            type="file" 
                            ref={jsonFileInputRef} 
                            className="hidden" 
                            accept=".json" 
                            onChange={(e) => handleFileChange(e, 'json')} 
                        />
                        
                        {analyzing && importType === 'json' ? (
                            <div className="flex flex-col items-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mb-2"></div>
                                <span className="text-slate-500">{analyzingMsg}</span>
                            </div>
                        ) : (
                            <>
                                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                                    <Database size={32} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium dark:text-white">导入 cloudnav_backup.json 文件</p>
                                    <p className="text-xs text-slate-500 mt-1">与 WebDAV 备份格式一致，便于数据迁移</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Links-only Import Option */}
                    <div className="flex flex-col items-center justify-center space-y-4 py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                         onClick={() => linksFileInputRef.current?.click()}>
                        <input
                            type="file"
                            ref={linksFileInputRef}
                            className="hidden"
                            accept=".json"
                            onChange={(e) => handleFileChange(e, 'links')}
                        />

                        {analyzing && importType === 'links' ? (
                            <div className="flex flex-col items-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mb-2"></div>
                                <span className="text-slate-500">{analyzingMsg}</span>
                            </div>
                        ) : (
                            <>
                                <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
                                    <ListTree size={32} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium dark:text-white">导入链接 JSON 文件</p>
                                    <p className="text-xs text-slate-500 mt-1">仅导入链接，可选择目标分类</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        downloadLinksTemplate();
                                    }}
                                    className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 underline"
                                >
                                    下载链接模板
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {step === 'preview' && (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center border border-green-100 dark:border-green-900/30">
                            <div className="text-xl font-bold text-green-600 dark:text-green-400">{newLinksCount}</div>
                            <div className="text-xs text-green-700 dark:text-green-500">新增链接</div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-center border border-slate-200 dark:border-slate-600">
                            <div className="text-xl font-bold text-slate-600 dark:text-slate-400">{duplicateCount}</div>
                            <div className="text-xs text-slate-500">重复跳过</div>
                        </div>
                         <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center border border-purple-100 dark:border-purple-900/30">
                            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{importMode === 'original' ? newCategoriesCount : 0}</div>
                            <div className="text-xs text-purple-700 dark:text-purple-500">新增分类</div>
                        </div>
                    </div>

                    {/* Duplicate Links Handling Options */}
                    {duplicateCount > 0 && (
                        <div className="space-y-3">
                            <label className="text-sm font-medium dark:text-slate-300 flex items-center gap-2">
                                <Database size={16} />
                                重复链接处理方式
                            </label>

                            <div className="space-y-2">
                                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${duplicateHandlingMode === 'skip' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <input type="radio" name="duplicateMode" className="mt-1" checked={duplicateHandlingMode === 'skip'} onChange={() => setDuplicateHandlingMode('skip')} />
                                    <div>
                                        <div className="flex items-center gap-2 font-medium text-sm dark:text-white">
                                            跳过重复链接
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">不导入重复的链接，保持现有链接不变。</p>
                                    </div>
                                </label>

                                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${duplicateHandlingMode === 'overwrite' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <input type="radio" name="duplicateMode" className="mt-1" checked={duplicateHandlingMode === 'overwrite'} onChange={() => setDuplicateHandlingMode('overwrite')} />
                                    <div>
                                        <div className="flex items-center gap-2 font-medium text-sm dark:text-white">
                                            覆盖现有链接
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">用新链接的信息更新现有链接。</p>
                                    </div>
                                </label>

                                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${duplicateHandlingMode === 'add' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <input type="radio" name="duplicateMode" className="mt-1" checked={duplicateHandlingMode === 'add'} onChange={() => setDuplicateHandlingMode('add')} />
                                    <div>
                                        <div className="flex items-center gap-2 font-medium text-sm dark:text-white">
                                            添加为重复链接
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">将重复链接作为新链接添加，标题会标记为"副本"。</p>
                                    </div>
                                </label>

                                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${duplicateHandlingMode === 'merge' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <input type="radio" name="duplicateMode" className="mt-1" checked={duplicateHandlingMode === 'merge'} onChange={() => setDuplicateHandlingMode('merge')} />
                                    <div>
                                        <div className="flex items-center gap-2 font-medium text-sm dark:text-white">
                                            智能合并信息
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">优先使用新链接的信息，但保留现有链接的非空字段。</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {newLinksCount === 0 && duplicateCount === 0 ? (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
                            <AlertCircle size={16} />
                            <span>未发现新链接，所有链接已存在。</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <label className="text-sm font-medium dark:text-slate-300">
                                {importType === 'links' ? '导入方式' : '导入方式'}
                            </label>

                            {importType !== 'links' && (
                                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${importMode === 'original' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <input type="radio" name="mode" className="mt-1" checked={importMode === 'original'} onChange={() => setImportMode('original')} />
                                    <div>
                                        <div className="flex items-center gap-2 font-medium text-sm dark:text-white">
                                            <ListTree size={16} /> 保持原目录结构
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">如果分类不存在，将自动创建。</p>
                                    </div>
                                </label>
                            )}

                            {/* Links类型的选项 */}
                            {importType === 'links' && (
                                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${importMode === 'original' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <input type="radio" name="mode" className="mt-1" checked={importMode === 'original'} onChange={() => setImportMode('original')} />
                                    <div>
                                        <div className="flex items-center gap-2 font-medium text-sm dark:text-white">
                                            <ListTree size={16} /> 保持原有分类
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">保留链接文件中的分类信息，未指定分类的链接将导入到默认分类。</p>
                                    </div>
                                </label>
                            )}

                            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${importMode === 'merge' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                <input type="radio" name="mode" className="mt-1" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} />
                                <div className="w-full">
                                    <div className="flex items-center gap-2 font-medium text-sm dark:text-white">
                                        <FolderInput size={16} /> {importType === 'links' ? '全部导入到指定目录' : '全部导入到指定目录'}
                                    </div>
                                    <div className="mt-2 space-y-2">
                                        {/* 显示子分类选项的开关 */}
                                        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                            <input
                                                type="checkbox"
                                                checked={showSubCategories}
                                                onChange={(e) => {
                                                    setShowSubCategories(e.target.checked);
                                                    // 如果关闭子分类显示，确保选择的是顶级分类
                                                    if (!e.target.checked) {
                                                        const currentCategory = categories.find(c => c.id === targetCategoryId);
                                                        if (currentCategory?.isSubcategory) {
                                                            setTargetCategoryId(categories[0]?.id || 'common');
                                                        }
                                                    }
                                                }}
                                                disabled={importMode !== 'merge'}
                                                className="rounded"
                                            />
                                            显示二级目录
                                        </label>

                                        {/* 目录选择 */}
                                        {showSubCategories ? (
                                            // 两级选择模式
                                            <div className="space-y-1">
                                                <select
                                                    value={
                                                        (() => {
                                                            const currentCategory = categories.find(c => c.id === targetCategoryId);
                                                            return currentCategory?.isSubcategory ? currentCategory.parentId : targetCategoryId;
                                                        })()
                                                    }
                                                    onChange={(e) => {
                                                        const parentId = e.target.value;
                                                        const subCategories = getSubCategories(parentId);
                                                        if (subCategories.length > 0) {
                                                            setTargetCategoryId(subCategories[0].id);
                                                        } else {
                                                            setTargetCategoryId(parentId);
                                                        }
                                                    }}
                                                    disabled={importMode !== 'merge'}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none"
                                                >
                                                    {getTopLevelCategories()
                                                        .filter(c => getSubCategories(c.id).length === 0)
                                                        .map(c => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                </select>

                                                {/* 子分类选择 */}
                                                {(() => {
                                                    const currentCategory = categories.find(c => c.id === targetCategoryId);
                                                    const parentId = currentCategory?.isSubcategory
                                                        ? currentCategory.parentId
                                                        : targetCategoryId;
                                                    const subCategories = getSubCategories(parentId);

                                                    return subCategories.length > 0 ? (
                                                        <select
                                                            value={targetCategoryId}
                                                            onChange={(e) => setTargetCategoryId(e.target.value)}
                                                            disabled={importMode !== 'merge'}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none"
                                                        >
                                                            {subCategories.map(c => (
                                                                <option key={c.id} value={c.id}>└ {c.name}</option>
                                                            ))}
                                                        </select>
                                                    ) : null;
                                                })()}
                                            </div>
                                        ) : (
                                            // 单级选择模式
                                            <select
                                                value={targetCategoryId}
                                                onChange={(e) => setTargetCategoryId(e.target.value)}
                                                disabled={importMode !== 'merge'}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none"
                                            >
                                                {[
                                                    // 添加没有子分类的顶级分类
                                                    ...getTopLevelCategories().filter(c => getSubCategories(c.id).length === 0),
                                                    // 添加所有子分类
                                                    ...categories.filter(c => c.isSubcategory)
                                                ].map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.isSubcategory ? `└ ${getCategoryDisplayName(c.id)}` : c.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            </label>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
            {step === 'upload' ? (
                <button onClick={handleClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">取消</button>
            ) : (
                <>
                    <button onClick={resetState} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">重新选择</button>
                    <button
                        onClick={executeImport}
                        disabled={newLinksCount === 0 && duplicateCount === 0}
                        className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-medium"
                    >
                        <Check size={16} /> 确认导入 {newLinksCount > 0 ? `(${newLinksCount})` : `(处理 ${duplicateCount} 个重复链接)`}
                    </button>
                </>
            )}
        </div>

      </div>
    </div>
  );
};

export default ImportModal;