import React, { useRef, useEffect, useLayoutEffect } from 'react';

interface EditableBlockProps {
  isEditing: boolean;
  value: string;
  onChange: (newValue: string) => void;
  tagName?: keyof JSX.IntrinsicElements;
  className?: string;
  multiline?: boolean;
}

export default function EditableBlock({
  isEditing,
  value,
  onChange,
  tagName: Tag = 'span',
  className = '',
  multiline = false
}: EditableBlockProps) {
  const contentEditableRef = useRef<HTMLElement>(null);
  const isFocusedRef = useRef(false);
  const debounceRef = useRef<any>(null);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // Sync internal content with external value ONLY when we aren't actively typing
  // to avoid jumping cursor issues.
  useLayoutEffect(() => {
    if (
      contentEditableRef.current &&
      !isFocusedRef.current &&
      contentEditableRef.current.textContent !== value
    ) {
      contentEditableRef.current.textContent = value;
    }
  }, [value, isEditing]);

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    isFocusedRef.current = false;
    clearTimeout(debounceRef.current);
    const textContent = multiline ? (e.target as HTMLElement).innerText || '' : e.target.textContent || '';
    if (textContent !== value) {
      onChange(textContent);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLElement>) => {
    const textContent = multiline ? (e.target as HTMLElement).innerText || '' : (e.target as HTMLElement).textContent || '';
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(textContent), 250);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  if (!isEditing) {
    const DynamicTag = Tag as any;
    return <DynamicTag className={className}>{value}</DynamicTag>;
  }

  const DynamicTag = Tag as any;

  return (
    <DynamicTag
      ref={contentEditableRef}
      contentEditable={true}
      suppressContentEditableWarning={true}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      className={`
        ${className} 
        ${multiline ? 'whitespace-pre-wrap' : ''}
        outline-none transition-colors duration-200 
        hover:bg-black/5 hover:ring-2 hover:ring-gray-400/50 hover:ring-dashed 
        focus:bg-black/10 focus:ring-2 focus:ring-gray-400/80 focus:ring-solid focus:shadow-sm
        cursor-text relative group rounded-sm p-0.5 -m-0.5
      `}
      title="Click to edit"
    />
  );
}
