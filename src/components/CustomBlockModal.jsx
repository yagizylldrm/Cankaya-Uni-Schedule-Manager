import React, { useState } from 'react';
import { useSchedule } from '../context/useSchedule';
import AppDialog from './AppDialog';
import { Trash2, Check, Clock, Calendar } from 'lucide-react';

const PRESETS = [
  { label: 'Yemek Arası', title: 'Yemek Arası', note: '12-13 / Öğle Yemeği', color: 'amber' },
  { label: 'Mola / Kahve', title: 'Mola', note: 'Dinlenme & Kahve', color: 'emerald' },
  { label: 'Ders Çalışma', title: 'Ders Çalışma', note: 'Kütüphane / Tekrar', color: 'blue' },
  { label: 'Spor / Fitness', title: 'Spor', note: 'Antrenman', color: 'purple' },
  { label: 'İş / Staj', title: 'İş / Staj', note: 'Ofis & Çalışma', color: 'rose' },
];

const COLORS = [
  { id: 'amber', name: '🟡 Amber / Turuncu', ring: 'ring-amber-500', bg: 'bg-amber-100 border-amber-300 text-amber-900' },
  { id: 'emerald', name: '🟢 Zümrüt / Yeşil', ring: 'ring-emerald-500', bg: 'bg-emerald-100 border-emerald-300 text-emerald-900' },
  { id: 'blue', name: '🔵 Mavi / Lacivert', ring: 'ring-blue-500', bg: 'bg-blue-100 border-blue-300 text-blue-900' },
  { id: 'purple', name: '🟣 Mor / Eflatun', ring: 'ring-purple-500', bg: 'bg-purple-100 border-purple-300 text-purple-900' },
  { id: 'rose', name: '🔴 Kırmızı / Gül', ring: 'ring-rose-500', bg: 'bg-rose-100 border-rose-300 text-rose-900' },
  { id: 'slate', name: '⚪ Gri / Nötr', ring: 'ring-slate-500', bg: 'bg-slate-100 border-slate-300 text-slate-900' },
];

export default function CustomBlockModal() {
  const {
    customBlockModalData,
    setCustomBlockModalData,
    setCustomBlock,
    deleteCustomBlock,
    notify
  } = useSchedule();

  if (!customBlockModalData) return null;

  const { day, timeSlot, currentBlock } = customBlockModalData;
  const isEdit = !!currentBlock;

  const [title, setTitle] = useState(currentBlock?.title || 'Yemek Arası');
  const [note, setNote] = useState(currentBlock?.note || '');
  const [color, setColor] = useState(currentBlock?.color || 'amber');
  const [allWeekdays, setAllWeekdays] = useState(false);
  const [chosenTime, setChosenTime] = useState(timeSlot);

  const handlePresetSelect = (p) => {
    setTitle(p.title);
    setNote(p.note);
    setColor(p.color);
  };

  const handleSave = () => {
    if (!title.trim()) {
      notify('Lütfen bir başlık girin.');
      return;
    }

    if (allWeekdays) {
      ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'].forEach(d => {
        setCustomBlock(d, chosenTime, title.trim(), note.trim(), color);
      });
    } else {
      setCustomBlock(day, chosenTime, title.trim(), note.trim(), color);
    }

    setCustomBlockModalData(null);
  };

  const handleDelete = () => {
    deleteCustomBlock(day, timeSlot);
    setCustomBlockModalData(null);
  };

  return (
    <AppDialog
      isOpen={Boolean(customBlockModalData)}
      onClose={() => setCustomBlockModalData(null)}
      title={isEdit ? 'Özel Program Kutusunu Düzenle' : 'Özel Program Kutusu Ekle'}
      description={`${day} • ${timeSlot}`}
      titleId="custom-block-modal-title"
      size="md"
      footer={
        <div className="flex items-center justify-between w-full text-xs">
          {isEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              className="btn-secondary text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5 px-3 py-1.5 min-h-[36px]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Sil</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCustomBlockModalData(null)}
              className="btn-secondary text-xs px-3.5 py-1.5 min-h-[36px]"
            >
              İptal
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="btn-primary text-xs px-4 py-1.5 min-h-[36px] font-semibold"
            >
              {isEdit ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Time selector if creating new block */}
        {!isEdit && (
          <div>
            <label htmlFor="activity-time" className="block text-xs font-semibold text-ink mb-1">
              Etkinlik saati
            </label>
            <select
              id="activity-time"
              value={chosenTime}
              onChange={(e) => setChosenTime(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border-subtle rounded-xl text-xs sm:text-sm text-ink focus:outline-none focus:ring-1 focus:ring-brand font-mono"
            >
              {Array.from(new Set([
                timeSlot,
                '08:40 - 09:30',
                ...Array.from({ length: 12 }, (_, i) => `${String(i + 9).padStart(2, '0')}:00 - ${String(i + 9).padStart(2, '0')}:50`)
              ])).map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>
        )}

        {/* Quick Presets */}
        <div>
          <span className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1.5">
            Hazır Şablonlar
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => handlePresetSelect(p)}
                className="px-2.5 py-1 rounded-lg bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-medium transition"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title Input */}
        <div>
          <label htmlFor="custom-block-title" className="block text-xs font-semibold text-ink mb-1">
            Başlık *
          </label>
          <input
            id="custom-block-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn: Öğle Yemeği, Kütüphane..."
            className="w-full px-3 py-2 bg-surface border border-border-subtle rounded-xl text-xs sm:text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand font-sans"
          />
        </div>

        {/* Note Input */}
        <div>
          <label htmlFor="custom-block-note" className="block text-xs font-semibold text-ink mb-1">
            Not / Açıklama (Opsiyonel)
          </label>
          <input
            id="custom-block-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Örn: 12:00 - 13:00 arası yemek"
            className="w-full px-3 py-2 bg-surface border border-border-subtle rounded-xl text-xs sm:text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand font-sans"
          />
        </div>

        {/* Color Selection */}
        <div>
          <span className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-2">
            Renk Seçimi
          </span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Etkinlik rengi">
            {COLORS.map(c => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={color === c.id}
                onClick={() => setColor(c.id)}
                className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition ${c.bg} ${
                  color === c.id ? 'ring-2 ring-offset-1 ring-ink' : 'opacity-80 hover:opacity-100'
                }`}
              >
                <span className="font-semibold text-xs">{c.name}</span>
                {color === c.id && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* Apply to all weekdays checkbox */}
        <div className="pt-1">
          <label className="flex items-center gap-2 text-ink text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allWeekdays}
              onChange={(e) => setAllWeekdays(e.target.checked)}
              className="rounded border-border-subtle text-ink focus:ring-brand w-4 h-4"
            />
            <span>Bu saati tüm hafta içi günlerine (Pzt - Cuma) uygula</span>
          </label>
        </div>

      </div>
    </AppDialog>
  );
}
