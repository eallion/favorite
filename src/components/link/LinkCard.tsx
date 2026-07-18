import React, { useState, useRef, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { LinkItem } from '../../../types';

interface LinkCardProps {
  link: LinkItem;
  viewMode: 'compact' | 'detailed';
  isBatchEditMode: boolean;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onEdit: (link: LinkItem) => void;
  onDelete: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, link: LinkItem) => void;
  isDraggable?: boolean;
  authToken?: string | null;
  isEditMode?: boolean;
  onWeightChange?: (linkId: string, weight: number) => void;
}

// 从文本生成颜色（纯计算，无异步）
function generateColorFromText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 45%)`;
}

export function LinkCard({
  link, viewMode, isBatchEditMode, isSelected,
  onToggleSelection, onEdit, onDelete, onContextMenu,
  isDraggable = true, authToken, isEditMode = false, onWeightChange,
}: LinkCardProps) {
  const [imgError, setImgError] = useState(false);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [weightValue, setWeightValue] = useState(link.weight?.toString() || '0');
  const cardRef = useRef<HTMLDivElement>(null);

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({
    id: link.id,
    disabled: !isDraggable || isBatchEditMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isDetailedView = viewMode === 'detailed';
  const iconSrc = link.icon && !imgError ? link.icon : null;

  // 同步生成颜色，无需 useEffect + Canvas
  const fallbackColor = generateColorFromText(link.title);

  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [setNodeRef]);

  const handleClick = () => {
    if (isBatchEditMode) {
      onToggleSelection(link.id);
    } else if (!isEditMode) {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleWeightSave = () => {
    const num = parseInt(weightValue, 10);
    if (!isNaN(num) && onWeightChange) {
      onWeightChange(link.id, num);
    }
    setIsEditingWeight(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isBatchEditMode || isEditMode) return;
    e.preventDefault();
    const touch = e.touches[0];
    (e.currentTarget as any).dataset.touchX = String(touch.clientX);
    (e.currentTarget as any).dataset.touchY = String(touch.clientY);

    touchTimerRef.current = setTimeout(() => {
      const syntheticEvent = {
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX: touch.clientX,
        clientY: touch.clientY,
        currentTarget: e.currentTarget,
        target: e.target,
      } as unknown as React.MouseEvent<HTMLDivElement>;
      onContextMenu(syntheticEvent, link);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchTimerRef.current) return;
    const touch = e.touches[0];
    const startX = parseFloat((e.currentTarget as any).dataset.touchX || '0');
    const startY = parseFloat((e.currentTarget as any).dataset.touchY || '0');
    if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  return (
    <div
      ref={mergedRef}
      style={{
        ...style,
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      className={`link-card group relative transition-all duration-200 ${
        isSelected
          ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
      } ${isBatchEditMode ? 'cursor-pointer' : isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
        isDetailedView
          ? 'flex flex-col rounded-2xl border shadow-sm p-4 min-h-[100px] items-start justify-start text-left w-full min-w-0'
          : 'flex items-center justify-between rounded-xl border shadow-sm p-3'
      } ${isDragging ? 'shadow-2xl scale-105' : ''}`}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, link)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      {...(isDraggable && !isBatchEditMode ? attributes : {})}
      {...(isDraggable && !isBatchEditMode ? listeners : {})}
    >
      {/* 背景模糊图标 - 使用 CSS 颜色而非提取 */}
      <div className="icon-bg">
        {iconSrc ? (
          <img src={iconSrc} alt="" loading="lazy" onError={() => setImgError(true)} />
        ) : (
          <span style={{ fontSize: '48px', fontWeight: 'bold', color: fallbackColor }}>
            {link.title.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Batch edit checkbox */}
      {isBatchEditMode && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(link.id)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Weight badge */}
      {isEditMode && onWeightChange && (
        <div className="absolute top-2 left-2 z-10">
          {isEditingWeight ? (
            <input
              type="number"
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
              onBlur={handleWeightSave}
              onKeyDown={(e) => e.key === 'Enter' && handleWeightSave()}
              className="w-12 h-6 text-xs text-center bg-white dark:bg-slate-700 border border-blue-400 rounded px-1 outline-none"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingWeight(true);
                setWeightValue(link.weight?.toString() || '0');
              }}
              className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              title="点击编辑 weight"
            >
              w:{link.weight ?? 0}
            </button>
          )}
        </div>
      )}

      {/* Link content */}
      <div className={`icon-main flex flex-1 min-w-0 overflow-hidden h-full w-full ${
        isDetailedView ? 'flex-col md:flex-row md:gap-4 md:items-center' : 'items-center'
      }`}>
        {isDetailedView ? (
          <>
            <div className="flex flex-col md:flex-row md:items-start gap-3 w-full min-w-0">
              <div className="flex items-center gap-3 w-full md:hidden">
                <div className="relative shrink-0">
                  <div className="flex items-center justify-center text-sm font-bold uppercase w-10 h-10 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 shadow-sm"
                    style={{ color: fallbackColor }}>
                    {iconSrc ? <img src={iconSrc} alt="" className="w-6 h-6" loading="lazy" onError={() => setImgError(true)} /> : link.title.charAt(0).toUpperCase()}
                  </div>
                  {link.isPrivate && (
                    <span className="absolute top-0.5 right-0.5 text-[10px] leading-none" title="私人书签">🔒</span>
                  )}
                </div>
                <h3 className="flex-1 min-w-0 text-slate-800 dark:text-slate-200 text-base font-medium overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={link.title}>
                  {link.title}
                </h3>
              </div>
              {link.description && (
                <p className="w-full md:hidden text-sm text-slate-600 dark:text-slate-400 leading-relaxed overflow-hidden text-ellipsis whitespace-nowrap" title={link.description}>
                  {link.description}
                </p>
              )}
              <div className="relative hidden md:flex shrink-0">
                <div className="flex items-center justify-center text-sm font-bold uppercase w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 shadow-sm"
                  style={{ color: fallbackColor }}>
                  {iconSrc ? <img src={iconSrc} alt="" className="w-10 h-10" loading="lazy" onError={() => setImgError(true)} /> : link.title.charAt(0).toUpperCase()}
                </div>
                {link.isPrivate && (
                  <span className="absolute top-1 right-1 text-xs leading-none" title="私人书签">🔒</span>
                )}
              </div>
              <div className="hidden md:flex flex-1 min-w-0 flex-col justify-start w-full">
                <h3 className="text-slate-800 dark:text-slate-200 text-base font-medium w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={link.title}>
                  {link.title}
                </h3>
                {link.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={link.description}>
                    {link.description}
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="relative shrink-0 mr-3">
              <div className="flex items-center justify-center text-sm font-bold uppercase w-10 h-10 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 shadow-sm"
                style={{ color: fallbackColor }}>
                {iconSrc ? <img src={iconSrc} alt="" className="w-6 h-6" loading="lazy" onError={() => setImgError(true)} /> : link.title.charAt(0).toUpperCase()}
              </div>
              {link.isPrivate && (
                <span className="absolute top-0.5 right-0.5 text-[10px] leading-none" title="私人书签">🔒</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-slate-800 dark:text-slate-200 text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={link.title}>
                {link.title}
              </h3>
              {link.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap" title={link.description}>
                  {link.description}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Drag handle */}
      {isDraggable && !isBatchEditMode && (
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={16} />
        </button>
      )}
    </div>
  );
}
