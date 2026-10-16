import React, { useState } from 'react';
import { useSchedule } from '../context/useSchedule';
import AppDialog from './AppDialog';
import { Layers, Copy, Plus, Trash2, Edit3, Check, X } from 'lucide-react';

export default function DraftManager({ onClose }) {
  const { drafts, activeDraftId, createDraft, openDraft, renameDraft, deleteDraft } = useSchedule();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const run = (action) => {
    try {
      action();
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <AppDialog
      isOpen={true}
      onClose={onClose}
      title="Plan taslakları"
      description="Değişiklikler etkin plana otomatik kaydedilir. Transkript tüm planlarda ortaktır."
      titleId="draft-manager-title"
      size="md"
    >
      <div className="space-y-4 text-xs">
        {/* Drafts List */}
        <div className="space-y-2">
          {drafts.map(d => (
            <div
              key={d.id}
              className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition-colors ${
                d.id === activeDraftId
                  ? 'bg-surface-muted/70 border-brand/40 shadow-sm'
                  : 'bg-surface border-border-subtle hover:bg-surface-muted/30'
              }`}
            >
              {editing === d.id ? (
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <input
                    aria-label="Yeni plan adı"
                    type="text"
                    value={name}
                    maxLength={60}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-surface border border-brand rounded-lg text-ink text-xs focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => run(() => { renameDraft(d.id, name); setEditing(null); })}
                    className="btn-primary text-xs px-2.5 py-1.5 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Kaydet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="btn-secondary text-xs px-2 py-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Layers className={`w-4 h-4 shrink-0 ${d.id === activeDraftId ? 'text-brand' : 'text-ink-muted'}`} />
                    <span className="font-semibold text-ink text-xs sm:text-sm truncate">
                      {d.name}
                    </span>
                    <span className="text-[11px] text-ink-muted tabular-nums shrink-0">
                      ({d.courseCount} ders)
                    </span>
                    {d.id === activeDraftId && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 shrink-0">
                        Etkin
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {d.id !== activeDraftId && (
                      <button
                        type="button"
                        onClick={() => { openDraft(d.id); onClose(); }}
                        className="btn-secondary text-xs px-2.5 py-1"
                      >
                        Aç
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => { setEditing(d.id); setName(d.name); }}
                      className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3 text-ink-muted" />
                      <span>Adlandır</span>
                    </button>

                    {confirmDeleteId === d.id ? (
                      <div className="flex items-center gap-1 bg-surface border border-rose-200 dark:border-rose-900 rounded-lg p-0.5">
                        <span className="text-[10px] text-rose-600 font-semibold px-1">Silinsin mi?</span>
                        <button
                          type="button"
                          onClick={() => { run(() => deleteDraft(d.id)); setConfirmDeleteId(null); }}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
                        >
                          Evet
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 py-1 text-ink-muted hover:text-ink text-[11px]"
                        >
                          İptal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={drafts.length === 1}
                        onClick={() => {
                          if (d.courseCount) setConfirmDeleteId(d.id);
                          else run(() => deleteDraft(d.id));
                        }}
                        className="text-xs text-ink-muted hover:text-rose-600 p-1.5 rounded-lg hover:bg-surface-muted transition disabled:opacity-30 disabled:hover:text-ink-muted"
                        title={drafts.length === 1 ? 'Son kalan plan silinemez' : 'Planı sil'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="sr-only">Sil</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Create New Draft Section */}
        <div className="pt-3 border-t border-border-subtle space-y-2">
          <span className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider">
            Yeni Taslak Oluştur
          </span>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Yeni plan adı"
              value={editing ? '' : name}
              disabled={Boolean(editing)}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 min-w-[160px] px-3 py-2 bg-surface border border-border-subtle rounded-xl text-xs sm:text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand font-sans"
            />
            <button
              type="button"
              disabled={Boolean(editing)}
              onClick={() => run(() => { createDraft(name); setName(''); onClose(); })}
              className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5 disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Boş plan</span>
            </button>
            <button
              type="button"
              disabled={Boolean(editing)}
              onClick={() => run(() => { createDraft(name, true); setName(''); })}
              className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5 disabled:opacity-40"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Kopyala</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 font-medium">
            {error}
          </p>
        )}
      </div>
    </AppDialog>
  );
}
