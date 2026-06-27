import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const DRINK_EMOJIS = [
  '🍹', '🍸', '🍷', '🍾', '🍻', '🥂', '🥃',
  '🍺', '🍶', '🍵', '☕', '🧃', '🧋', '🥤',
  '🧉', '🍼', '🥛', '🍯', '🍮', '🍰', '🎂',
  '🧁', '🍪', '🍩', '🍫', '🍬', '🍭', '🍡',
  '🍢', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠',
  '🥐', '🍞', '🥖', '🥨', '🥯',
];

export default function DrinkEmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-12 p-0 text-xl flex items-center justify-center shrink-0"
        >
          {value || '🍹'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="grid grid-cols-7 gap-1.5">
          {DRINK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded-lg transition-all text-lg',
                value === emoji
                  ? 'bg-primary/20 border-2 border-primary ring-2 ring-primary/50'
                  : 'bg-muted hover:bg-muted/80 border border-transparent hover:border-border'
              )}
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}