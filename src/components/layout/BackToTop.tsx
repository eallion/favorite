import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface BackToTopProps {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

export function BackToTop({ scrollContainerRef }: BackToTopProps) {
  const [visible, setVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll > 0) {
        const progress = Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));
        setScrollProgress(progress);
      }

      setVisible(scrollTop > 300);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef]);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scrollProgress / 100) * circumference;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="回到顶部"
      title="回到顶部"
      className={`fixed bottom-6 right-6 z-40 w-10 h-10 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 backdrop-blur-md border cursor-pointer group ${
        visible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 translate-y-4 scale-90 pointer-events-none'
      } bg-white/85 hover:bg-white border-slate-200/90 hover:border-blue-400 dark:bg-slate-800/85 dark:hover:bg-slate-800 dark:border-slate-700/90 dark:hover:border-blue-500 hover:shadow-xl active:scale-95`}
    >
      {/* 滚动进度环 */}
      <svg
        className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-0.5"
        viewBox="0 0 36 36"
      >
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="2"
          className="stroke-slate-200/60 dark:stroke-slate-700/60"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="stroke-blue-500 transition-all duration-150 ease-out"
        />
      </svg>

      {/* 回到顶部图标 */}
      <ArrowUp
        size={16}
        className="relative z-10 text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:-translate-y-0.5 transition-all duration-200"
      />
    </button>
  );
}
