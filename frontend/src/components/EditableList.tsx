import React, { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Plus } from 'lucide-react';

interface EditableListProps<T> {
  isEditing?: boolean;
  items: T[];
  onItemsChange: (items: T[]) => void;
  getItemId: (item: T) => string;
  strategy?: 'rect' | 'vertical' | 'horizontal';
  className?: string;
  onAdd?: () => void;
  renderItem: (item: T, index: number) => React.ReactNode;
}

function SortableItem({ id, isEditing, children, onRemove }: { id: string; isEditing: boolean; children: React.ReactNode; onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative ${isEditing ? 'border-2 border-dashed border-gray-300 rounded p-2' : ''}`}>
      {isEditing && (
        <div className="absolute top-2 right-2 z-50 flex gap-2 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity" style={{ opacity: 1 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 bg-white text-red-600 rounded border border-gray-200 hover:bg-red-50 shadow-sm"
            title="Remove item"
          >
            <Trash2 size={14} />
          </button>
          <div {...attributes} {...listeners} className="p-1 bg-white text-gray-600 rounded border border-gray-200 cursor-grab active:cursor-grabbing shadow-sm hover:bg-gray-50">
            <GripVertical size={14} />
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

export default function EditableList<T>({
  isEditing = false,
  items,
  onItemsChange,
  getItemId,
  strategy = 'vertical',
  className = '',
  onAdd,
  renderItem,
}: EditableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getStrategy = () => {
    switch (strategy) {
      case 'rect': return rectSortingStrategy;
      case 'horizontal': return horizontalListSortingStrategy;
      case 'vertical': default: return verticalListSortingStrategy;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => getItemId(item) === active.id);
      const newIndex = items.findIndex((item) => getItemId(item) === over.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex);
      // Reassign order properties if they exist
      const reorderedItems = newItems.map((item: any, idx) => {
        if (typeof item === 'object' && item !== null) {
          return { ...item, order: idx + 1 };
        }
        return item;
      }) as unknown as T[];
      onItemsChange(reorderedItems);
    }
  };

  const handleRemove = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onItemsChange(newItems);
  };

  const itemIds = useMemo(() => items.map(getItemId), [items, getItemId]);

  return (
    <div className="w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={itemIds}
          strategy={getStrategy()}
        >
          <div className={className}>
            {items.map((item, index) => (
              <SortableItem
                key={getItemId(item)}
                id={getItemId(item)}
                isEditing={isEditing}
                onRemove={() => handleRemove(index)}
              >
                {renderItem(item, index)}
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      
      {isEditing && onAdd && (
        <div className="mt-6 flex justify-center w-full">
          <button
            onClick={onAdd}
            className="flex w-full items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-gray-300 text-gray-500 rounded hover:bg-gray-50 hover:text-dark-red hover:border-dark-red transition-colors"
          >
            <Plus size={18} />
            <span className="text-sm font-medium font-sans">Add New Item</span>
          </button>
        </div>
      )}
    </div>
  );
}
