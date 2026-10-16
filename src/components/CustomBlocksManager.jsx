import React, { useState } from 'react';
import { DAYS } from '../utils/plan';
import { useSchedule } from '../context/useSchedule';
import AppDialog from './AppDialog';
import { Trash2, Edit3, Calendar } from 'lucide-react';

export default function CustomBlocksManager({ onClose }) {
  const {
    customBlocks,
    deleteCustomBlock,
    clearCustomBlocks,
    setCustomBlockModalData
  } = useSchedule();

  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const blocks = Object.values(customBlocks).sort(
    (a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.time_slot.localeCompare(b.time_slot)
  );

  return (
    <AppDialog
      isOpen={true}
      onClose={onClose}
      title="Özel etkinlikler"
      description="Programdaki boş saatlere eklediğiniz kişisel not ve etkinlikler."
      titleId="custom-blocks-manager-title"
      size="md"
      footer={
        <div className="flex items-center justify-between w-full text-xs">
          {blocks.length > 0 ? (
            confirmClearAll ? (
              <div className="flex items-center gap-1.5 bg-surface border border-rose-200 dark:border-rose-900/60 rounded-xl p-1">
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold px-1.5">
                  Tümü silinsin mi?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearCustomBlocks();
                    setConfirmClearAll(false);
                  }}
                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold"
                >
                  Evet
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="btn-secondary text-[11px] px-2 py-1"
                >
                  İptal
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="btn-secondary text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5 px-3 py-1.5 min-h-[36px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Tümünü temizle</span>
              </button>
            )
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs px-3.5 py-1.5 min-h-[36px]"
          >
            Kapat
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-xs">
        {blocks.length > 0 ? (
          <div className="space-y-2">
            {blocks.map((block) => (
              <div
                key={`${block.day}:${block.time_slot}`}
                className="p-3 rounded-xl border border-border-subtle bg-surface hover:bg-surface-muted/30 flex flex-wrap items-center justify-between gap-2 transition-colors"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink text-xs sm:text-sm truncate">
                      {block.title}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-surface-muted border border-border-subtle text-ink-muted">
                      {block.day}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted font-mono">
                    {block.time_slot}
                    {block.note ? ` · ${block.note}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomBlockModalData({
                        day: block.day,
                        timeSlot: block.time_slot,
                        currentBlock: block
                      });
                      onClose();
                    }}
                    className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1 min-h-[32px]"
                  >
                    <Edit3 className="w-3 h-3 text-ink-muted" />
                    <span>Düzenle</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteCustomBlock(block.day, block.time_slot)}
                    className="btn-secondary text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1 px-2.5 py-1 min-h-[32px]"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Sil</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-ink-muted space-y-2">
            <Calendar className="w-8 h-8 mx-auto text-ink-muted/50" />
            <p className="text-xs">
              Henüz etkinlik eklenmedi. Programdaki bir saate tıklayarak ekleyebilirsiniz.
            </p>
          </div>
        )}
      </div>
    </AppDialog>
  );
}
