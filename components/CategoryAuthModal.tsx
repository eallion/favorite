import React, { useState } from 'react';
import { Lock, ArrowRight, Loader2, X } from 'lucide-react';
import { Category } from '../types';
import { API_ENDPOINTS } from '../src/constants';

interface CategoryAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  onUnlock: (categoryId: string) => void;
}

const CategoryAuthModal: React.FC<CategoryAuthModalProps> = ({ isOpen, onClose, category, onUnlock }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !category) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const url = `${API_ENDPOINTS.STORAGE}?getConfig=links&category=${encodeURIComponent(category.id)}&catPassword=${encodeURIComponent(password.trim())}`;
      console.log('[CategoryAuthModal] Request URL:', url);
      console.log('[CategoryAuthModal] Category ID:', category.id, 'Name:', category.name);

      const res = await fetch(url);
      console.log('[CategoryAuthModal] Response status:', res.status);

      if (res.status === 403) {
        setError('密码错误');
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        console.log('[CategoryAuthModal] Error response:', text);
        setError(`验证失败: ${res.status}`);
        setIsLoading(false);
        return;
      }

      // 密码正确，解锁分类
      console.log('[CategoryAuthModal] Unlock success for:', category.id);
      onUnlock(category.id);
      setPassword('');
      setError('');
      setIsLoading(false);
      onClose();
    } catch (err) {
      console.error('Category auth error:', err);
      setError('网络错误，请重试');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
            <X size={20} className="text-slate-400" />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
            <Lock size={28} />
          </div>
          <h2 className="text-lg font-bold dark:text-white">解锁 "{category.name}"</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
            该目录受密码保护，请输入密码访问
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all text-center tracking-widest"
              placeholder="目录密码"
              autoFocus
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center font-medium animate-pulse">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!password || isLoading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <>
              解锁 <ArrowRight size={18} />
            </>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CategoryAuthModal;
