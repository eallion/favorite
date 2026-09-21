import React from 'react';
import CardSkeleton from '../../../components/CardSkeleton';
import { ViewMode } from '../../../types';

interface ContentSkeletonProps {
  viewMode?: ViewMode;
}

export function ContentSkeleton({ viewMode = 'detailed' }: ContentSkeletonProps) {
  const gridClass = viewMode === 'detailed'
    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
    : viewMode === 'app'
    ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8">
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24" />
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-8" />
        </div>
        <div className={`grid gap-3 ${gridClass}`}>
          <CardSkeleton viewMode={viewMode} count={viewMode === 'app' ? 12 : 6} />
        </div>
      </section>
      {[1, 2, 3].map(i => (
        <section key={i}>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" style={{ width: `${60 + i * 20}px` }} />
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-8" />
          </div>
          <div className={`grid gap-3 ${gridClass}`}>
            <CardSkeleton viewMode={viewMode} count={4 + i} />
          </div>
        </section>
      ))}
    </div>
  );
}
