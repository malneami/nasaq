'use client';

import { Plus, CheckSquare, StickyNote, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { quickAddTask } from '@/lib/tasks/actions';
import { captureInboxItem } from '@/lib/inbox/actions';

type Mode = 'task' | 'note';

export function QuickAddFab() {
  const t = useTranslations('quickAdd');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('task');
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();

  function openSheet(next: Mode) {
    setMode(next);
    setText('');
    setOpen(true);
  }

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;

    startTransition(async () => {
      if (mode === 'task') {
        const result = await quickAddTask({ title: trimmed });
        if (result.error) {
          toast.error(t('taskFailed'));
          return;
        }
        toast.success(t('taskAdded'));
      } else {
        const result = await captureInboxItem({
          rawText: trimmed,
          inputKind: 'note',
        });
        if (result.error) {
          toast.error(t('noteFailed'));
          return;
        }
        toast.success(t('noteAdded'));
      }
      setOpen(false);
      setText('');
      router.refresh();
    });
  }

  return (
    <>
      {/* Floating action button */}
      <div className="fixed bottom-6 end-6 z-40 flex flex-col items-end gap-3">
        {/* Quick option chips — visible when no sheet open */}
        {!open && (
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => openSheet('note')}
              className="bento-card flex items-center gap-2 rounded-2xl border border-primary/20 bg-card/90 px-4 py-2.5 text-sm font-medium text-foreground shadow-md backdrop-blur-sm transition-all hover:scale-105 hover:shadow-lg"
            >
              <StickyNote className="size-4 text-primary" />
              {t('addNote')}
            </button>
            <button
              type="button"
              onClick={() => openSheet('task')}
              className="bento-card flex items-center gap-2 rounded-2xl border border-primary/20 bg-card/90 px-4 py-2.5 text-sm font-medium text-foreground shadow-md backdrop-blur-sm transition-all hover:scale-105 hover:shadow-lg"
            >
              <CheckSquare className="size-4 text-primary" />
              {t('addTask')}
            </button>
          </div>
        )}

        {/* Main FAB */}
        {!open && (
          <button
            type="button"
            aria-label={t('label')}
            className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-110 hover:shadow-xl active:scale-95"
          >
            <Plus className="size-6" />
          </button>
        )}
      </div>

      {/* Bottom sheet form */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          closeLabel={t('close')}
          className="rounded-t-3xl border-t-2 border-primary/20"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {mode === 'task' ? (
                <CheckSquare className="size-5 text-primary" />
              ) : (
                <StickyNote className="size-5 text-primary" />
              )}
              {mode === 'task' ? t('taskTitle') : t('noteTitle')}
            </SheetTitle>
            <SheetDescription>
              {mode === 'task' ? t('taskHint') : t('noteHint')}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4">
            <Textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mode === 'task' ? t('taskPlaceholder') : t('notePlaceholder')}
              className="min-h-24 rounded-2xl"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>

          <SheetFooter className="flex-row items-center gap-2">
            <SheetClose asChild>
              <Button variant="outline" className="flex-1">
                {t('cancel')}
              </Button>
            </SheetClose>
            <Button
              className="flex-1"
              disabled={pending || !text.trim()}
              onClick={handleSubmit}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t('submit')
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
