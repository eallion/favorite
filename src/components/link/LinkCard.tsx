"use client";

import React, { useRef, useCallback, useEffect, useState } from "react";
import { ExternalLink, Trash2, GripVertical } from "lucide-react";
import { Bookmark } from "../types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface LinkCardProps {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}

export default function LinkCard({ bookmark, onDelete, isAdmin }: LinkCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: bookmark.id, disabled: !isAdmin });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // 长按检测：触摸开始
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isLongPress.current = false;
      longPressTimer.current = setTimeout(() => {
        isLongPress.current = true;
        // 获取触摸位置
        const touch = e.touches[0];
        setMenuPos({ x: touch.clientX, y: touch.clientY });
        setShowMenu(true);
        // 禁止默认的上下文菜单/文本选择
        if (cardRef.current) {
          cardRef.current.style.webkitTouchCallout = "none";
          cardRef.current.style.userSelect = "none";
        }
      }, 600); // 600ms 长按阈值
    },
    []
  );

  // 触摸结束
  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // 延迟重置，避免误触发点击
    setTimeout(() => {
      isLongPress.current = false;
    }, 100);
  }, []);

  // 触摸移动（取消长按）
  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // 右键菜单（桌面端）
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setMenuPos({ x: e.clientX, y: e.clientY });
      setShowMenu(true);
    },
    []
  );

  // 点击其他地方关闭菜单
  useEffect(() => {
    const handleClickOutside = () => setShowMenu(false);
    if (showMenu) {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showMenu]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const handleDelete = () => {
    onDelete(bookmark.id);
    setShowMenu(false);
  };

  const handleOpenLink = () => {
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div
        ref={(node) => {
          setNodeRef(node);
          (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        style={style}
        {...attributes}
        className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 
                   shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onClick={(e) => {
          // 如果是长按触发的，不执行点击跳转
          if (isLongPress.current) {
            e.preventDefault();
            return;
          }
          handleOpenLink();
        }}
      >
        {/* 拖拽手柄（仅管理员可见） */}
        {isAdmin && (
          <div
            {...listeners}
            className="absolute top-2 right-2 p-1.5 rounded-lg cursor-grab active:cursor-grabbing
                       opacity-0 group-hover:opacity-100 transition-opacity
                       text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-gray-700 z-10"
            title="拖拽排序"
          >
            <GripVertical size={16} />
          </div>
        )}

        <div className="p-4">
          {/* 图标和标题 */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 
                            flex items-center justify-center text-white font-bold text-lg">
              {bookmark.title.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate pr-6">
                {bookmark.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {bookmark.description || bookmark.url}
              </p>
            </div>
          </div>

          {/* URL 和标签 */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[70%]">
              {new URL(bookmark.url).hostname}
            </span>
            {bookmark.category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 
                               text-gray-600 dark:text-gray-300">
                {bookmark.category}
              </span>
            )}
          </div>
        </div>

        {/* 底部操作栏（hover 显示） */}
        <div className="px-4 pb-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 
                        transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenLink();
            }}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 
                       hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <ExternalLink size={12} />
            打开
          </button>
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 
                         hover:text-red-700 dark:hover:text-red-300 transition-colors ml-auto"
            >
              <Trash2 size={12} />
              删除
            </button>
          )}
        </div>
      </div>

      {/* 右键/长按菜单 */}
      {showMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border 
                     border-gray-200 dark:border-gray-700 py-1 min-w-[140px]"
          style={{
            left: Math.min(menuPos.x, window.innerWidth - 160),
            top: Math.min(menuPos.y, window.innerHeight - 120),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              handleOpenLink();
              setShowMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 
                       hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <ExternalLink size={14} />
            打开链接
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(bookmark.url);
              setShowMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 
                       hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            复制链接
          </button>
          {isAdmin && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 
                           hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              >
                <Trash2 size={14} />
                删除书签
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
