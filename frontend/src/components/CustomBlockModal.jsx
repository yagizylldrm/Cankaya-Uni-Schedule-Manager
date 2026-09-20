import React, { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { X, Trash2, Check, Clock, Calendar } from 'lucide-react';

const PRESETS = [
  { label: 'Yemek Arası', title: 'Yemek Arası', note: '12-13 / Öğle Yemeği', color: 'amber' },
  { label: 'Mola / Kahve', title: 'Mola', note: 'Dinlenme & Kahve', color: 'emerald' },
  { label: 'Ders Çalışma', title: 'Ders Çalışma', note: 'Kütüphane / Tekrar', color: 'blue' },
  { label: 'Spor / Fitness', title: 'Spor', note: 'Antrenman', color: 'purple' },
  { label: 'İş / Staj', title: 'İş / Staj', note: 'Ofis & Çalışma', color: 'rose' },
];

const COLORS = [
  { id: 'amber', name: '🟡 Amber / Turuncu', ring: 'ring-amber-500', bg: 'bg-amber-100 border-amber-400 text-amber-900' },
  { id: 'emerald', name: '🟢 Zümrüt / Yeşil', ring: 'ring-emerald-500', bg: 'bg-emerald-100 border-emerald-400 text-emerald-900' },
  { id: 'blue', name: '🔵 Mavi / Lacivert', ring: 'ring-blue-500', bg: 'bg-blue-100 border-blue-400 text-blue-900' },
  { id: 'purple', name: '🟣 Mor / Eflatun', ring: 'ring-purple-500', bg: 'bg-purple-100 border-purple-400 text-purple-900' },
  { id: 'rose', name: '🔴 Kırmızı / Gül', ring: 'ring-rose-500', bg: 'bg-rose-100 border-rose-400 text-rose-900' },
  { id: 'slate', name: '⚪ Gri / Slate', ring: 'ring-slate-500', bg: 'bg-slate-100 border-slate-300 text-slate-900' },
];

export default function CustomBlockModal() {
  const {
    customBlockModalData,
    setCustomBlockModalData,
    setCustomBlock,
    deleteCustomBlock
  } = useSchedule();

  if (!customBlockModalData) return null;

  const { day, timeSlot, currentBlock } = customBlockModalData;
  const isEdit = !!currentBlock;

  const [title, setTitle] = useState(currentBlock?.title || 'Yemek Arası');
  const [note, setNote] = useState(currentBlock?.note || '');
  const [color, setColor] = useState(currentBlock?.color || 'amber');
  const [allWeekdays, setAllWeekdays] = useState(false);

  const handlePresetSelect = (p) => {
    setTitle(p.title);
    setNote(p.note);
    setColor(p.color);
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('Lütfen bir başlık girin.');
      return;
    }

    if (allWeekdays) {
      ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'].forEach(d => {
        setCustomBlock(d, timeSlot, title.trim(), note.trim(), color);
      });
    } else {
      setCustomBlock(day, timeSlot, title.trim(), note.trim(), color);
    }

    setCustomBlockModalData(null);
  };

  const handleDelete = () => {
    deleteCustomBlock(day, timeSlot);
    setCustomBlockModalData(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-dark-border overflow-hidden">
        
        {/* Header */}
        <div className="p-4 bg-slate-50 dark:bg-dark-card border-b border-slate-200 dark:border-dark-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-dark-text">
              {isEdit ? 'Özel Program Kutusunu Düzenle' : 'Özel Program Kutusu Ekle'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-dark-subtext flex items-center gap-1 mt-0.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{day}</span>
              <span>•</span>
              <Clock className="w-3.5 h-3.5" />
              <span>{timeSlot}</span>
            </p>
          </div>

          <button
            onClick={() => setCustomBlockModalData(null)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 text-xs">
          
          {/* Quick Presets */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-dark-subtext uppercase tracking-wider mb-2">
              Hazır Şablonlar
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-dark-card hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-dark-text font-medium transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-dark-subtext uppercase tracking-wider mb-1">
              Başlık *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Öğle Yemeği, Kütüphane..."
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl text-slate-800 dark:text-dark-text focus:outline-none focus:ring-1 focus:ring-cankaya-blue"
            />
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-dark-subtext uppercase tracking-wider mb-1">
              Not / Açıklama (Opsiyonel)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Örn: 12:00 - 13:00 arası yemek"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl text-slate-800 dark:text-dark-text focus:outline-none focus:ring-1 focus:ring-cankaya-blue"
            />
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-dark-subtext uppercase tracking-wider mb-2">
              Renk Seçimi
            </label>
            <div className="grid grid-cols-2 gap-2">
              {COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`p-2 rounded-xl border text-left flex items-center justify-between transition ${c.bg} ${
                    color === c.id ? 'ring-2 ring-cankaya-blue dark:ring-cankaya-gold' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <span className="font-semibold">{c.name}</span>
                  {color === c.id && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Apply to all weekdays checkbox */}
          <div className="pt-1">
            <label className="flex items-center gap-2 text-slate-700 dark:text-dark-text cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allWeekdays}
                onChange={(e) => setAllWeekdays(e.target.checked)}
                className="rounded border-slate-300 dark:border-dark-border text-cankaya-blue focus:ring-cankaya-blue w-4 h-4"
              />
              <span>Bu saati tüm hafta içi günlerine (Pzt - Cuma) uygula</span>
            </label>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-dark-card border-t border-slate-200 dark:border-dark-border flex items-center justify-between gap-2">
          {isEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Sil</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCustomBlockModalData(null)}
              className="px-3 py-2 rounded-xl text-slate-600 dark:text-dark-subtext hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition"
            >
              İptal
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-cankaya-blue hover:bg-cankaya-navy text-cankaya-gold text-xs font-semibold shadow-md transition active:scale-95"
            >
              {isEdit ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
