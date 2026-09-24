import React, { useState } from 'react';
import { useSchedule } from '../context/useSchedule';

export default function DraftManager({ onClose }) {
  const { drafts, activeDraftId, createDraft, openDraft, renameDraft, deleteDraft } = useSchedule();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const run = action => { try { action(); setError(''); } catch (err) { setError(err.message); } };
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="presentation" onMouseDown={onClose}>
    <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-dark-surface rounded-2xl p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Plan taslakları" onMouseDown={e => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">Plan taslakları</h2><button onClick={onClose} aria-label="Kapat">✕</button></div>
      <p className="text-sm text-slate-500 mb-4">Değişiklikler etkin plana otomatik kaydedilir. Transkript tüm planlarda ortaktır.</p>
      <div className="space-y-2 mb-4">{drafts.map(d => <div key={d.id} className="rounded-lg border border-slate-200 dark:border-dark-border p-3 flex flex-wrap items-center gap-2">
        {editing === d.id ? <input className="min-w-0 flex-1 rounded border p-1 dark:bg-dark-card" value={name} maxLength={60} onChange={e => setName(e.target.value)} aria-label="Yeni plan adı" /> : <span className="min-w-0 flex-1 font-medium">{d.name} <span className="text-xs font-normal text-slate-500">({d.courseCount} ders)</span></span>}
        {editing === d.id ? <button className="text-sm text-cankaya-blue dark:text-cankaya-gold" onClick={() => run(() => { renameDraft(d.id, name); setEditing(null); })}>Kaydet</button> : <>
          {d.id === activeDraftId ? <span className="text-xs text-emerald-600">Etkin</span> : <button className="text-sm text-cankaya-blue dark:text-cankaya-gold" onClick={() => { openDraft(d.id); onClose(); }}>Aç</button>}
          <button className="text-sm" onClick={() => { setEditing(d.id); setName(d.name); }}>Adlandır</button>
          <button disabled={drafts.length === 1} className="text-sm text-red-600 disabled:opacity-40" onClick={() => {
            if (d.courseCount && !window.confirm(`“${d.name}” planı silinsin mi?`)) return;
            run(() => deleteDraft(d.id));
          }}>Sil</button>
        </>}
      </div>)}</div>
      <div className="flex flex-wrap gap-2"><input className="flex-1 min-w-40 rounded border p-2 dark:bg-dark-card" placeholder="Yeni plan adı" value={editing ? '' : name} disabled={Boolean(editing)} maxLength={60} onChange={e => setName(e.target.value)} />
        <button className="primary-action" disabled={Boolean(editing)} onClick={() => run(() => { createDraft(name); setName(''); onClose(); })}>Boş plan</button>
        <button className="rounded-lg border px-3 py-2 text-sm" disabled={Boolean(editing)} onClick={() => run(() => { createDraft(name, true); setName(''); })}>Kopyala</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  </div>;
}
