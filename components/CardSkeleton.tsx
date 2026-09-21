import React from 'react';
import { ViewMode } from '../types';

interface CardSkeletonProps {
  viewMode?: ViewMode;
  count?: number;
}

const CardSkeleton: React.FC<CardSkeletonProps> = ({
  viewMode = 'detailed',
  count = 1
}) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {skeletons.map((index) => (
        <div
          key={index}
          className={
            viewMode === 'app'
              ? 'relative flex flex-col rounded-2xl p-2 items-center justify-center min-h-[96px] sm:min-h-[108px] bg-transparent border-0 shadow-none'
              : `relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden ${
                  viewMode === 'detailed'
                    ? 'flex flex-col rounded-2xl p-4 min-h-[100px]'
                    : 'flex items-center rounded-xl p-3'
                }`
          }
          style={{
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            animationDelay: `${index * 50}ms`,
          }}
        >
          {viewMode === 'detailed' ? (
            <div className="flex flex-col md:flex-row md:items-start gap-3 w-full">
              <div className="flex items-center gap-3 w-full md:hidden">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                </div>
              </div>
              <div className="w-full md:hidden">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
              </div>
              <div className="hidden md:flex w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
              <div className="hidden md:flex flex-1 flex-col gap-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
            </div>
          ) : viewMode === 'app' ? (
            <div className="flex flex-col items-center justify-center w-full">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16 mt-2" />
            </div>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
            </div>
          )}
        </div>
      ))}
    </>
  );
};

export default CardSkeleton;
