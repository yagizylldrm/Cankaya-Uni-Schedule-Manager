import React from 'react';
import { DAYS } from '../utils/plan';
import { useSchedule } from '../context/useSchedule';

export default function CustomBlocksManager({ onClose }) {
  const { customBlocks, deleteCustomBlock, clearCustomBlocks, setCustomBlockModalData } = useSchedule();
  const blocks = Object.values(customBlocks).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.time_slot.localeCompare(b.time_slot));
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="presentation" onMouseDown={onClose}>
    <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-dark-surface rounded-2xl p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Özel etkinlikler" onMouseDown={e => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">Özel etkinlikler ({blocks.length})</h2><button onClick={onClose} aria-label="Kapat">✕</button></div>
      {blocks.length ? <div className="space-y-2">{blocks.map(block => <div key={`${block.day}:${block.time_slot}`} className="rounded-lg border border-slate-200 dark:border-dark-border p-3 flex items-center gap-2">
        <div className="flex-1 min-w-0"><strong>{block.title}</strong><p className="text-xs text-slate-500">{block.day} · {block.time_slot}{block.note ? ` · ${block.note}` : ''}</p></div>
        <button className="text-sm text-cankaya-blue dark:text-cankaya-gold" onClick={() => { setCustomBlockModalData({ day: block.day, timeSlot: block.time_slot, currentBlock: block }); onClose(); }}>Düzenle</button>
        <button className="text-sm text-red-600" onClick={() => deleteCustomBlock(block.day, block.time_slot)}>Sil</button>
      </div>)}</div> : <p className="text-sm text-slate-500">Henüz etkinlik eklenmedi. Programdaki bir saate tıklayarak ekleyebilirsiniz.</p>}
      {blocks.length > 0 && <button className="mt-4 text-sm text-red-600" onClick={() => { if (window.confirm('Tüm özel etkinlikler silinsin mi?')) clearCustomBlocks(); }}>Tümünü temizle</button>}
    </div>
  </div>;
}
