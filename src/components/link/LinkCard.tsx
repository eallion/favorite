import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { LinkItem } from '../../../types';
import { extractColorFromImage, generateColorFromText, ExtractedColor } from '../../../src/utils/colorExtractor';

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

export function LinkCard({
  link, viewMode, isBatchEditMode, isSelected,
  onToggleSelection, onEdit, onDelete, onContextMenu,
  isDraggable = true, authToken, isEditMode = false, onWeightChange,
}: LinkCardProps) {
  const [imgError, setImgError] = useState(false);
  const [color, setColor] = useState<ExtractedColor | null>(null);
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [weightValue, setWeightValue] = useState(link.weight?.toString() || '0');
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

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
    ...(color ? {
      '--icon-color': color.hex,
      '--icon-color-rgb': color.rgb,
    } as React.CSSProperties : {}),
  };

  const isDetailedView = viewMode === 'detailed';
  const iconSrc = link.icon && !imgError ? link.icon : null;

  // 观察可见性，离屏卡片延迟执行颜色提取
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observerRef.current.observe(el);
    return () => observerRef.current?.disconnect();
  }, []);

  // 提取图标颜色 - 仅在卡片可见时执行
  useEffect(() => {
    if (!isVisible) return;
    if (!iconSrc) {
      setColor(generateColorFromText(link.title));
      return;
    }

    extractColorFromImage(iconSrc).then(result => {
      if (result) {
        setColor(result);
      }
    });
  }, [iconSrc, link.title, isVisible]);

  // 鼠标位置追踪
  const rafRef = useRef<number | null>(null);
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      const card = cardRef.current;
      if (card) {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        card.style.setProperty('--pointer-x', `${x}`);
        card.style.setProperty('--pointer-y', `${y}`);
      }
      rafRef.current = null;
    });
  }, []);

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

  return (
    <div
      ref={mergedRef}
      style={style}
      data-color-ready={!!color || undefined}
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
      onMouseMove={handleMouseMove}
      {...(isDraggable && !isBatchEditMode ? attributes : {})}
      {...(isDraggable && !isBatchEditMode ? listeners : {})}
    >
      {/* 背景模糊图标 */}
      <div className="icon-bg">
        {iconSrc ? (
          <img src={iconSrc} alt="" loading="lazy" onError={() => setImgError(true)} />
        ) : (
          <span style={{ fontSize: '48px', fontWeight: 'bold' }}>{link.title.charAt(0).toUpperCase()}</span>
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
                <div className="text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold uppercase shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 shadow-sm">
                  {iconSrc ? <img src={iconSrc} alt="" className="w-6 h-6" loading="lazy" onError={() => setImgError(true)} /> : link.title.charAt(0).toUpperCase()}
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
              <div className="hidden md:flex text-blue-600 dark:text-blue-400 items-center justify-center text-sm font-bold uppercase shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 shadow-sm">
                {iconSrc ? <img src={iconSrc} alt="" className="w-10 h-10" loading="lazy" onError={() => setImgError(true)} /> : link.title.charAt(0).toUpperCase()}
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
            <div className="flex items-center gap-3 w-full">
              <div className="text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold uppercase shrink-0 w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-700">
                {iconSrc ? <img src={iconSrc} alt="" className="w-5 h-5" loading="lazy" onError={() => setImgError(true)} /> : link.title.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={link.title}>
                {link.title}
              </h3>
            </div>
            {link.description && (
              <div className="tooltip-custom absolute left-0 -top-8 w-max max-w-[200px] bg-black text-white text-xs p-2 rounded opacity-0 invisible group-hover:visible group-hover:opacity-100 transition-all z-20 pointer-events-none truncate">
                {link.description}
              </div>
            )}
          </>
        )}
      </div>

      {/* Hover actions - 只在编辑模式下显示 */}
      {!isBatchEditMode && authToken && isEditMode && (
        <div className={`flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-md p-1 absolute z-10 ${
          isDetailedView ? 'top-3 right-3' : 'top-1/2 -translate-y-1/2 right-2'
        }`}>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(link); }}
            className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
            title="编辑"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.65-.07-.97l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.08-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.32-.07.64-.07.97c0 .33.03.65.07.97l-2.11 1.63c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.39 1.06.73 1.69.98l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.25 1.17-.59 1.69-.98l2.49 1c.22.08.49 0 .61-.22l2-3.46c.13-.22.07-.49-.12-.64l-2.11-1.63Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
