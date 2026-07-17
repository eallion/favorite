import React, { useState, useEffect } from 'react';
import { X, ArrowUp, ArrowDown, Trash2, Edit2, Plus, Check, Lock, Unlock, Palette, Save } from 'lucide-react';
import { Category } from '../types';
import Icon from './Icon';
import IconSelector from './IconSelector';
import CategoryActionAuthModal from './CategoryActionAuthModal';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onUpdateCategories: (newCategories: Category[]) => void;
  onDeleteCategory: (id: string) => void;
  onVerifyPassword?: (password: string) => Promise<boolean>;
}

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onUpdateCategories,
  onDeleteCategory,
  onVerifyPassword
}) => {
  // 本地编辑状态 - 不直接修改原始数据
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editParentId, setEditParentId] = useState<string>('');
  const [editWeight, setEditWeight] = useState<number>(0);

  const [newCatName, setNewCatName] = useState('');
  const [newCatPassword, setNewCatPassword] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Folder');
  const [newCatParentId, setNewCatParentId] = useState<string>('');

  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  const [iconSelectorTarget, setIconSelectorTarget] = useState<'edit' | 'new' | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [hasVerifiedPermissions, setHasVerifiedPermissions] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'edit' | 'delete';
    categoryId: string;
    categoryName: string;
  } | null>(null);

  // 打开弹窗时加载数据到本地状态
  useEffect(() => {
    if (isOpen) {
      setLocalCategories([...categories]);
      setHasChanges(false);
      setEditingId(null);
    }
  }, [isOpen, categories]);

  if (!isOpen) return null;

  // 获取顶级分类
  const getTopLevelCategories = () => {
    return localCategories.filter(cat => !cat.isSubcategory && !cat.parentId);
  };

  // 获取可选择的父分类
  const getParentOptions = (excludeId?: string) => {
    return localCategories.filter(cat => {
      if (cat.id === excludeId) return false;
      if (cat.isSubcategory || cat.parentId) return false;
      if (excludeId) {
        const isDescendant = (parentId: string, childId: string): boolean => {
          const parent = localCategories.find(c => c.id === parentId);
          if (!parent) return false;
          if (parent.parentId === childId) return true;
          return parent.parentId ? isDescendant(parent.parentId, childId) : false;
        };
        return !isDescendant(cat.id, excludeId);
      }
      return true;
    });
  };

  // 标记有改动
  const markChanged = (newCats: Category[]) => {
    setLocalCategories(newCats);
    setHasChanges(true);
  };

  // 排序：交换相邻同级分类的 weight 值
  const handleMove = (categoryId: string, direction: 'up' | 'down') => {
    const cat = localCategories.find(c => c.id === categoryId);
    if (!cat) return;

    const isTopLevel = !cat.isSubcategory && !cat.parentId;
    const siblings = localCategories
      .filter(c => isTopLevel ? (!c.isSubcategory && !c.parentId) : (c.parentId === cat.parentId))
      .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));

    const siblingIndex = siblings.findIndex(c => c.id === cat.id);
    if (direction === 'up' && siblingIndex <= 0) return;
    if (direction === 'down' && siblingIndex >= siblings.length - 1) return;

    const target = direction === 'up' ? siblings[siblingIndex - 1] : siblings[siblingIndex + 1];

    // 交换 weight
    const newCats = localCategories.map(c => {
      if (c.id === cat.id) return { ...c, weight: target.weight ?? 0 };
      if (c.id === target.id) return { ...c, weight: cat.weight ?? 0 };
      return c;
    });
    markChanged(newCats);
  };

  // 保存到服务器（按 weight 排序）
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 分别对一级分类和二级分类按 weight 排序
      const topLevel = localCategories
        .filter(c => !c.isSubcategory && !c.parentId)
        .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));
      const subs = localCategories
        .filter(c => c.isSubcategory || c.parentId)
        .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));

      // 合并：一级分类后紧跟其子分类
      const sorted: Category[] = [];
      for (const cat of topLevel) {
        sorted.push(cat);
        const children = subs.filter(s => s.parentId === cat.id);
        sorted.push(...children);
      }
      // 没有父分类的子分类（孤儿）
      const orphans = subs.filter(s => !topLevel.some(t => t.id === s.parentId));
      sorted.push(...orphans);

      onUpdateCategories(sorted);
      setHasChanges(false);
      onClose();
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // 密码验证
  const handlePasswordVerification = async (password: string): Promise<boolean> => {
    if (!onVerifyPassword) return true;
    try {
      return await onVerifyPassword(password);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  };

  const handleStartEdit = (cat: Category) => {
    if (!onVerifyPassword || hasVerifiedPermissions) {
      startEdit(cat);
      return;
    }
    setPendingAction({ type: 'edit', categoryId: cat.id, categoryName: cat.name });
    setIsAuthModalOpen(true);
  };

  const handleDeleteClick = (cat: Category) => {
    if (!onVerifyPassword || hasVerifiedPermissions) {
      if (confirm(`确定删除"${cat.name}"分类吗？该分类下的书签将移动到"常用推荐"。`)) {
        const newCats = localCategories.filter(c => c.id !== cat.id);
        markChanged(newCats);
      }
      return;
    }
    setPendingAction({ type: 'delete', categoryId: cat.id, categoryName: cat.name });
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = () => {
    if (!pendingAction) return;
    setHasVerifiedPermissions(true);

    if (pendingAction.type === 'edit') {
      const cat = localCategories.find(c => c.id === pendingAction.categoryId);
      if (cat) startEdit(cat);
    } else if (pendingAction.type === 'delete') {
      const cat = localCategories.find(c => c.id === pendingAction.categoryId);
      if (cat && confirm(`确定删除"${cat.name}"分类吗？`)) {
        markChanged(localCategories.filter(c => c.id !== cat.id));
      }
    }
    setPendingAction(null);
  };

  const handleAuthModalClose = () => {
    setIsAuthModalOpen(false);
    setPendingAction(null);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditPassword(cat.password || '');
    setEditIcon(cat.icon);
    setEditParentId(cat.parentId || '');
    setEditWeight(cat.weight ?? 0);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    const newCats = localCategories.map(c => {
      if (c.id === editingId) {
        return {
          ...c,
          name: editName.trim(),
          icon: editIcon,
          password: editPassword.trim() || undefined,
          parentId: editParentId || undefined,
          isSubcategory: !!editParentId,
          weight: editWeight,
        };
      }
      return c;
    });
    markChanged(newCats);
    setEditingId(null);
    setEditParentId('');
  };

  const handleAdd = () => {
    if (!newCatName.trim()) return;
    const maxWeight = Math.max(0, ...localCategories.map(c => c.weight ?? 0));
    const newCat: Category = {
      id: Date.now().toString(),
      name: newCatName.trim(),
      icon: newCatIcon,
      password: newCatPassword.trim() || undefined,
      parentId: newCatParentId || undefined,
      isSubcategory: !!newCatParentId,
      weight: maxWeight + 1,
    };
    markChanged([...localCategories, newCat]);
    setNewCatName('');
    setNewCatPassword('');
    setNewCatIcon('Folder');
    setNewCatParentId('');
  };

  const openIconSelector = (target: 'edit' | 'new') => {
    setIconSelectorTarget(target);
    setIsIconSelectorOpen(true);
  };

  const handleIconSelect = (iconName: string) => {
    if (iconSelectorTarget === 'edit') setEditIcon(iconName);
    else if (iconSelectorTarget === 'new') setNewCatIcon(iconName);
  };

  const cancelIconSelector = () => {
    setIsIconSelectorOpen(false);
    setIconSelectorTarget(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh]">
          <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold dark:text-white">
              分类管理
              {hasChanges && <span className="ml-2 text-sm text-amber-500">(有未保存的更改)</span>}
            </h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
              <X className="w-5 h-5 dark:text-slate-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {(() => {
              const topLevelCategories = localCategories
                .filter(cat => !cat.isSubcategory && !cat.parentId)
                .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));
              const renderCategoryWithChildren = (category: Category, level: number = 0) => {
                const children = localCategories
                .filter(cat => cat.parentId === category.id)
                .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));
                const categoryIndex = localCategories.findIndex(c => c.id === category.id);
                const isTopLevel = !category.isSubcategory && !category.parentId;
                const siblings = localCategories.filter(c =>
                  isTopLevel ? (!c.isSubcategory && !c.parentId) : (c.parentId === category.parentId)
                );
                const siblingIndex = siblings.findIndex(c => c.id === category.id);

                return (
                  <React.Fragment key={category.id}>
                    <div className={`flex flex-col p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg group gap-2 ${level > 0 ? 'ml-6' : ''}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1 mr-2">
                          <button
                            onClick={() => handleMove(category.id, 'up')}
                            disabled={siblingIndex === 0}
                            className="p-0.5 text-slate-400 hover:text-blue-500 disabled:opacity-30"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            onClick={() => handleMove(category.id, 'down')}
                            disabled={siblingIndex === siblings.length - 1}
                            className="p-0.5 text-slate-400 hover:text-blue-500 disabled:opacity-30"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {editingId === category.id && category.id !== 'common' ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <Icon name={editIcon} size={16} />
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="flex-1 p-1.5 px-2 text-sm rounded border border-blue-500 dark:bg-slate-800 dark:text-white outline-none"
                                  placeholder="分类名称"
                                  autoFocus
                                />
                                <button type="button" className="p-1 text-slate-400 hover:text-blue-600 transition-colors" onClick={() => openIconSelector('edit')} title="选择图标">
                                  <Palette size={16} />
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-500">父分类:</label>
                                <select
                                  value={editParentId}
                                  onChange={(e) => setEditParentId(e.target.value)}
                                  className="flex-1 p-1.5 px-2 text-sm rounded border border-blue-500 dark:bg-slate-800 dark:text-white outline-none"
                                  aria-label="选择父分类"
                                >
                                  <option value="">顶级分类</option>
                                  {getParentOptions(category.id).map(parent => (
                                    <option key={parent.id} value={parent.id}>作为 "{parent.name}" 的子分类</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-center gap-2">
                                <Lock size={14} className="text-slate-400" />
                                <input
                                  type="password"
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                  className="flex-1 p-1.5 px-2 text-sm rounded border border-blue-500 dark:bg-slate-800 dark:text-white outline-none"
                                  placeholder="密码（可选）"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">排序权重:</span>
                                <input
                                  type="number"
                                  value={editWeight}
                                  onChange={(e) => setEditWeight(Number(e.target.value))}
                                  className="w-20 p-1.5 px-2 text-sm rounded border border-blue-500 dark:bg-slate-800 dark:text-white outline-none"
                                  min={0}
                                />
                                <span className="text-xs text-slate-400">越小越靠前</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {category.isSubcategory && (
                                <div className="w-2 border-l-2 border-slate-300 dark:border-slate-600 ml-2"></div>
                              )}
                              <Icon name={category.icon} size={16} />
                              <span className="font-medium dark:text-slate-200 truncate">
                                {category.isSubcategory && <span className="text-slate-400 mr-1">└</span>}
                                {category.name}
                                {category.id === 'common' && (
                                  <span className="ml-2 text-xs text-slate-400">(默认分类，不可编辑)</span>
                                )}
                              </span>
                              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                w:{category.weight ?? 0}
                              </span>
                              {category.password && <Lock size={12} className="text-slate-400" />}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 self-start mt-1">
                          {editingId === category.id ? (
                            <button onClick={saveEdit} className="text-green-500 hover:bg-green-50 dark:hover:bg-slate-600 p-1.5 rounded bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-600">
                              <Check size={16} />
                            </button>
                          ) : (
                            <>
                              {category.id !== 'common' && (
                                <button onClick={() => handleStartEdit(category)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded">
                                  <Edit2 size={14} />
                                </button>
                              )}
                              {category.id !== 'common' && (
                                <button onClick={() => handleDeleteClick(category)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded">
                                  <Trash2 size={14} />
                                </button>
                              )}
                              {category.id === 'common' && (
                                <div className="p-1.5 text-slate-300" title="常用推荐分类不能被删除">
                                  <Lock size={14} />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {children.map(child => renderCategoryWithChildren(child, level + 1))}
                  </React.Fragment>
                );
              };

              return topLevelCategories.map(cat => renderCategoryWithChildren(cat));
            })()}
          </div>

          {/* 添加新分类 */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">添加新分类</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon name={newCatIcon} size={16} />
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="分类名称"
                  className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button type="button" className="p-1 text-gray-500 hover:text-blue-600 transition-colors" onClick={() => openIconSelector('new')} title="选择图标">
                  <Palette size={16} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">父分类:</label>
                <select
                  value={newCatParentId}
                  onChange={(e) => setNewCatParentId(e.target.value)}
                  className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  aria-label="选择父分类"
                >
                  <option value="">顶级分类</option>
                  {getParentOptions().map(parent => (
                    <option key={parent.id} value={parent.id}>作为 "{parent.name}" 的子分类</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={newCatPassword}
                    onChange={(e) => setNewCatPassword(e.target.value)}
                    placeholder="密码 (可选)"
                    className="w-full pl-8 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  />
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!newCatName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* 底部保存/取消按钮 */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Save size={14} />
              {isSaving ? '保存中...' : '保存更改'}
            </button>
          </div>

          {/* 图标选择器 */}
          {isIconSelectorOpen && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">选择图标</h3>
                  <button type="button" onClick={cancelIconSelector} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="关闭图标选择器">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <IconSelector
                    onSelectIcon={(iconName) => {
                      handleIconSelect(iconName);
                      setIsIconSelectorOpen(false);
                      setIconSelectorTarget(null);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 密码验证弹窗 */}
          {isAuthModalOpen && pendingAction && (
            <CategoryActionAuthModal
              isOpen={isAuthModalOpen}
              onClose={handleAuthModalClose}
              onVerify={handlePasswordVerification}
              onVerified={handleAuthSuccess}
              actionType={pendingAction.type}
              categoryName={pendingAction.categoryName}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default CategoryManagerModal;
