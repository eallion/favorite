import React, { useState, useEffect, useRef } from 'react';
import { TickerConfig } from '../types';

const MastodonIcon = ({ size, className }: { size: number; className?: string }) => (
  <svg width={size} height={size * 1.053} viewBox="0 0 75 79" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M73.8393 17.4898C72.6973 9.00165 65.2994 2.31235 56.5296 1.01614C55.05 0.797115 49.4441 0 36.4582 0H36.3612C23.3717 0 20.585 0.797115 19.1054 1.01614C10.5798 2.27644 2.79399 8.28712 0.904997 16.8758C-0.00358524 21.1056 -0.100549 25.7949 0.0682394 30.0965C0.308852 36.2651 0.355538 42.423 0.91577 48.5665C1.30307 52.6474 1.97872 56.6957 2.93763 60.6812C4.73325 68.042 12.0019 74.1676 19.1233 76.6666C26.7478 79.2728 34.9474 79.7055 42.8039 77.9162C43.6682 77.7151 44.5217 77.4817 45.3645 77.216C47.275 76.6092 49.5123 75.9305 51.1571 74.7385C51.1797 74.7217 51.1982 74.7001 51.2112 74.6753C51.2243 74.6504 51.2316 74.6229 51.2325 74.5948V68.6416C51.2321 68.6154 51.2259 68.5896 51.2142 68.5661C51.2025 68.5426 51.1858 68.522 51.1651 68.5058C51.1444 68.4896 51.1204 68.4783 51.0948 68.4726C51.0692 68.4669 51.0426 68.467 51.0171 68.4729C45.9835 69.675 40.8254 70.2777 35.6502 70.2682C26.7439 70.2682 24.3486 66.042 23.6626 64.2826C23.1113 62.762 22.7612 61.1759 22.6212 59.5646C22.6197 59.5375 22.6247 59.5105 22.6357 59.4857C22.6466 59.4609 22.6633 59.4391 22.6843 59.422C22.7053 59.4048 22.73 59.3929 22.7565 59.3871C22.783 59.3813 22.8104 59.3818 22.8367 59.3886C27.7864 60.5826 32.8604 61.1853 37.9522 61.1839C39.1768 61.1839 40.3978 61.1839 41.6224 61.1516C46.7435 61.008 52.1411 60.7459 57.1796 59.7621C57.3053 59.7369 57.431 59.7154 57.5387 59.6831C65.4861 58.157 73.0493 53.3672 73.8178 41.2381C73.8465 40.7606 73.9184 36.2364 73.9184 35.7409C73.9219 34.0569 74.4606 23.7949 73.8393 17.4898Z" fill="url(#paint0_linear_mastodon)"/>
    <path d="M61.2484 27.0263V48.114H52.8916V27.6475C52.8916 23.3388 51.096 21.1413 47.4437 21.1413C43.4287 21.1413 41.4177 23.7409 41.4177 28.8755V40.0782H33.1111V28.8755C33.1111 23.7409 31.0965 21.1413 27.0815 21.1413C23.4507 21.1413 21.6371 23.3388 21.6371 27.6475V48.114H13.2839V27.0263C13.2839 22.7176 14.384 19.2946 16.5843 16.7572C18.8539 14.2258 21.8311 12.926 25.5264 12.926C29.8036 12.926 33.0357 14.5705 35.1905 17.8559L37.2698 21.346L39.3527 17.8559C41.5074 14.5705 44.7395 12.926 49.0095 12.926C52.7013 12.926 55.6784 14.2258 57.9553 16.7572C60.1531 19.2922 61.2508 22.7152 61.2484 27.0263Z" fill="white"/>
    <defs>
      <linearGradient id="paint0_linear_mastodon" x1="37.0692" y1="0" x2="37.0692" y2="79" gradientUnits="userSpaceOnUse">
        <stop stop-color="#6364FF"/>
        <stop offset="1" stop-color="#563ACC"/>
      </linearGradient>
    </defs>
  </svg>
);

interface TickerItem {
  id: string;
  content: string;
  url: string;
}

interface TickerProps {
  config?: TickerConfig;
  isCollapsed?: boolean;
}

const MastodonTicker: React.FC<TickerProps> = ({ config, isCollapsed }) => {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout>();
  const currentIndexRef = useRef(0);

  const defaultItems: TickerItem[] = [
    { id: 'default-1', content: '机会总是垂青于有准备的人！', url: '' },
    { id: 'default-2', content: 'Chance favors the prepared mind!', url: '' },
  ];

  useEffect(() => {
    if (!config || !config.enabled) {
      setItems(defaultItems);
      setLoading(false);
      return;
    }

    const fetchItems = async () => {
      try {
        let fetchedItems: TickerItem[] = [];

        if (config.source === 'mastodon' && config.mastodonInstance && config.mastodonUsername) {
          fetchedItems = await fetchMastodon(config);
        } else if (config.source === 'memos' && config.memosHost) {
          fetchedItems = await fetchMemos(config);
        } else if (config.source === 'custom' && config.customItems) {
          fetchedItems = config.customItems
            .filter(item => item.trim())
            .map((item, i) => ({ 
              id: `custom-${i}`, 
              content: processTickerContent(item), 
              url: '' 
            }));
        } else {
          fetchedItems = defaultItems;
        }

        setItems(fetchedItems);
        setLoading(false);
      } catch (err) {
        console.error('Ticker fetch error:', err);
        setError(`无法获取动态`);
        setLoading(false);
      }
    };

    fetchItems();
    const interval = setInterval(fetchItems, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [config]);

  // 向上滚动
  useEffect(() => {
    if (items.length <= 1 || isPaused) return;

    const scroll = () => {
      if (contentRef.current) {
        currentIndexRef.current++;
        const index = currentIndexRef.current;
        
        contentRef.current.style.transition = 'transform 0.5s ease-in-out';
        contentRef.current.style.transform = `translateY(${-index * 36}px)`;

        // 当到达最后一条（第一条的克隆）时
        if (index === items.length) {
          setTimeout(() => {
            if (contentRef.current) {
              contentRef.current.style.transition = 'none';
              contentRef.current.style.transform = 'translateY(0)';
              currentIndexRef.current = 0;
            }
          }, 500); // 等待过渡动画完成
        }
      }
    };

    intervalRef.current = setInterval(scroll, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [items.length, isPaused]);

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-full h-9 w-9 md:w-auto md:px-3 text-slate-500 dark:text-slate-400 leading-none">
        <MastodonIcon size={12} />
        <span className="hidden md:inline ml-2">加载中...</span>
      </div>
    );
  }

  if (error || items.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-full text-xs text-slate-500 dark:text-slate-400 h-9 leading-none">
        <MastodonIcon size={12} />
        <span className="hidden md:inline">{error || '暂无动态'}</span>
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center bg-slate-200 dark:bg-slate-700 rounded-full h-9 leading-none transition-all duration-300 ease-in-out overflow-hidden ${
        isCollapsed ? 'w-9 px-0 justify-center' : 'w-full px-3 gap-2'
      }`}
    >
      <MastodonIcon size={14} className="text-blue-500 shrink-0" />
      
      <div
        className={`relative overflow-hidden h-9 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-0 opacity-0' : 'flex-1 opacity-100'
        }`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div ref={contentRef} className="flex flex-col items-start">
          {items.map((item) => (
            <div key={item.id} className="shrink-0 h-9 flex items-center justify-center min-w-0">
              <div
                className="cursor-pointer hover:text-blue-500 transition-colors flex items-center gap-1 w-full min-w-0"
                onClick={() => item.url && window.open(item.url, '_blank')}
                title={item.content.replace(/<[^>]*>/g, '')}
              >
                <span 
                  className="text-xs text-slate-700 dark:text-slate-300 truncate w-full"
                  dangerouslySetInnerHTML={{ __html: item.content }}
                />
              </div>
            </div>
          ))}
          <div className="shrink-0 h-9 flex items-center min-w-0">
            <div
              className="cursor-pointer hover:text-blue-500 transition-colors flex items-center gap-1 w-full min-w-0"
              onClick={() => items[0]?.url && window.open(items[0].url, '_blank')}
              title={items[0]?.content.replace(/<[^>]*>/g, '')}
            >
              <span 
                className="text-xs text-slate-700 dark:text-slate-300 truncate w-full"
                dangerouslySetInnerHTML={{ __html: items[0]?.content || '' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 格式化 Ticker 内容，支持特殊表情替换
function processTickerContent(text: string): string {
  if (!text) return '';
  return text
    .replace(/:star_solid:/g, '🌕')
    .replace(/:star_half:/g, '<span style="transform: scaleX(-1); display: inline-block;">🌓</span>')
    .replace(/:star_empty:/g, '🌑');
}

// Mastodon 数据获取
async function fetchMastodon(config: any): Promise<TickerItem[]> {
  let instance = config.mastodonInstance;
  let username = config.mastodonUsername;

  if (username?.startsWith('@')) {
    const parts = username.split('@').filter(Boolean);
    if (parts.length === 2) {
      username = parts[0];
      instance = parts[1];
    }
  }

  const lookupRes = await fetch(`https://${instance}/api/v1/accounts/lookup?acct=${username}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'CloudNav/1.0' }
  });
  if (!lookupRes.ok) throw new Error('Account lookup failed');

  const account = await lookupRes.json();
  const params = new URLSearchParams({
    limit: (config.mastodonLimit || 10).toString(),
    exclude_replies: String(config.mastodonExcludeReplies !== false),
    exclude_reblogs: String(config.mastodonExcludeReblogs !== false),
  });

  const res = await fetch(`https://${instance}/api/v1/accounts/${account.id}/statuses?${params}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'CloudNav/1.0' }
  });
  if (!res.ok) throw new Error('Statuses fetch failed');

  const data = await res.json();
  return data
    .map((s: any) => {
      const content = s.content
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
      
      return {
        id: s.id,
        content: processTickerContent(content.substring(0, 120)),
        url: s.url,
      };
    })
    .filter((s: TickerItem) => s.content.length > 0);
}

// Memos 数据获取
async function fetchMemos(config: any): Promise<TickerItem[]> {
  const host = config.memosHost?.replace(/\/$/, '');
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (config.memosToken) {
    headers['Authorization'] = `Bearer ${config.memosToken}`;
  }

  // 构建 filter 参数，creator 格式：users/xxx
  let filter = '';
  const celFilters = [];
  
  if (config.memosCreator) {
    celFilters.push(`creator == "users/${config.memosCreator}"`);
  }
  
  // 添加 visibility 过滤，默认为 PUBLIC
  const visibility = config.memosVisibility || 'PUBLIC';
  celFilters.push(`visibility == "${visibility}"`);

  if (celFilters.length > 0) {
    filter = `&filter=${encodeURIComponent(celFilters.join(' && '))}`;
  }

  const res = await fetch(`${host}/api/v1/memos?pageSize=${config.memosLimit || 10}${filter}`, { headers });
  if (!res.ok) throw new Error('Memos fetch failed');

  const data = await res.json();
  const memos = data.memos || data || [];

  return memos.map((m: any) => {
    const content = (m.content || m.plainText || '').trim();
    return {
      id: m.uid || m.name || String(m.id),
      content: processTickerContent(content.substring(0, 120)),
      url: m.url || `${host}/${m.name || m.uid}`,
    };
  }).filter((m: TickerItem) => m.content.length > 0);
}

export default MastodonTicker;
