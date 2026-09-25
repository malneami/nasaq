'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createProjectNoteAction,
  deleteProjectNoteAction,
  listProjectNotesAction,
  updateProjectNoteAction,
} from '@/lib/projects/actions';

export function NotesPanel({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const queryClient = useQueryClient();
  const notesKey = ['project-notes', projectId] as const;

  const notesQuery = useQuery({
    queryKey: notesKey,
    queryFn: async () => {
      const result = await listProjectNotesAction(projectId);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.notes ?? [];
    },
  });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [pending, setPending] = useState(false);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: notesKey });
  }

  async function onCreate() {
    if (!title.trim()) {
      return;
    }
    setPending(true);
    const result = await createProjectNoteAction(projectId, {
      title: title.trim(),
      body: body.trim(),
    });
    setPending(false);
    if (result.error) {
      toast.error(t('saveFailed'));
      return;
    }
    setTitle('');
    setBody('');
    toast.success(t('saved'));
    await refresh();
  }

  async function onUpdate() {
    if (!editingId) {
      return;
    }
    setPending(true);
    const result = await updateProjectNoteAction(projectId, {
      noteId: editingId,
      title: editTitle,
      body: editBody,
    });
    setPending(false);
    if (result.error) {
      toast.error(t('saveFailed'));
      return;
    }
    setEditingId(null);
    toast.success(t('saved'));
    await refresh();
  }

  async function onDelete(noteId: string) {
    setPending(true);
    const result = await deleteProjectNoteAction(projectId, noteId);
    setPending(false);
    if (result.error) {
      toast.error(t('saveFailed'));
      return;
    }
    toast.success(t('saved'));
    await refresh();
  }

  const notes = notesQuery.data ?? [];

  return (
    <div className="space-y-4">
      {/* New note form */}
      <div className="space-y-2 rounded-lg border border-border p-3">
        <Input
          value={title}
          placeholder={t('noteTitlePlaceholder')}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          value={body}
          placeholder={t('noteBodyPlaceholder')}
          rows={4}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button type="button" size="sm" disabled={pending || !title.trim()} onClick={() => void onCreate()}>
          {t('addNote')}
        </Button>
      </div>

      {/* Notes list */}
      {notesQuery.isError ? (
        <p className="text-sm text-destructive">{t('loadFailed')}</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noNotes')}</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg border border-border p-3">
              {editingId === note.id ? (
                <div className="space-y-2">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                  <Textarea
                    value={editBody}
                    rows={4}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => void onUpdate()}
                    >
                      {t('save')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      {t('cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium">{note.title}</h4>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(note.id);
                          setEditTitle(note.title);
                          setEditBody(note.body);
                        }}
                      >
                        {t('edit')}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => void onDelete(note.id)}
                      >
                        {t('remove')}
                      </Button>
                    </div>
                  </div>
                  {note.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-4">
                      {note.body}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
