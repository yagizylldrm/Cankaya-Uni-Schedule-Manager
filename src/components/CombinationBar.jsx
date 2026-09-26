import React from 'react';
import { useSchedule } from '../context/useSchedule';
import {
  ChevronLeft,
  ChevronRight,
  Sliders,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export default function CombinationBar({ onReviewCourses }) {
  const {
    sortedCombinations,
    comboSort,
    setComboSort,
    currentComboIndex,
    setCurrentComboIndex,
    preferences,
    updatePreferences,
    conflictsInfo,
    conflictDetails,

    generateSchedule,
    generationError,
    isGenerating,
    isScheduleStale,
    basket,
    basketTotalCredits,
    basketTotalEcts,
    customBlocks,
    restoredPlan,
    storageError
  } = useSchedule();

  const totalCombos = sortedCombinations.length;
  const currentCombo = totalCombos > 0 ? sortedCombinations[currentComboIndex] : null;
  const untimedCodes = currentCombo?.sections?.filter(section =>
    basket[section.course_code]?.untimed && section.section_no === 'SAATSIZ' && !section.slots?.length)
    .map(section => section.course_code) || [];

  const applyFix = action => {
    if (action.type === 'review_basket') return onReviewCourses();
    if (action.type === 'relax_preferences') {
      return generateSchedule({ preferences: { ...preferences, ...Object.fromEntries(action.keys.map(k => [k, false])) } });
    }
    if (action.type === 'remove_block') {
      const blocks = { ...customBlocks };
      delete blocks[action.key];
      return generateSchedule({ customBlocks: blocks });
    }
  };

  const handlePrev = () => {
    if (currentComboIndex > 0) {
      setCurrentComboIndex(currentComboIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentComboIndex < totalCombos - 1) {
      setCurrentComboIndex(currentComboIndex + 1);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-200 dark:border-dark-border p-3 sm:p-3.5 shadow-xs space-y-3">





      {generationError && <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300">
        <p>{generationError}</p><button disabled={isGenerating} onClick={() => generateSchedule()} className="underline py-2">Tekrar dene</button>
      </div>}
      {isScheduleStale && <p role="status" className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">Gösterilen program güncel seçimlere ait değil. Yeni sonuç gelene kadar dışa aktarılamaz.</p>}
      {storageError && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{storageError}</p>}
      {restoredPlan && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Program dosyası yüklendi. Güncel ders verileriyle kontrol etmek için yeniden program oluşturabilirsiniz.</p>}

      {/* Top Row: Navigation and Preferences */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">

        {/* Navigation Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-dark-card rounded-xl p-1 border border-slate-200 dark:border-dark-border">
            <button
              onClick={handlePrev}
              disabled={totalCombos === 0 || currentComboIndex === 0}
              className="p-1.5 rounded-lg text-slate-700 dark:text-dark-text hover:bg-white dark:hover:bg-dark-surface disabled:opacity-30 disabled:cursor-not-allowed transition shadow-xs"
              title="Önceki Kombinasyon"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 text-xs font-bold text-slate-800 dark:text-dark-text select-none">
              {totalCombos > 0 ? (
                <span>
                  {currentComboIndex + 1} <span className="text-slate-400">/ {totalCombos}</span>
                </span>
              ) : (
                <span className="text-slate-400 font-normal">Kombinasyon Yok</span>
              )}
            </div>

            <button
              onClick={handleNext}
              disabled={totalCombos === 0 || currentComboIndex >= totalCombos - 1}
              className="p-1.5 rounded-lg text-slate-700 dark:text-dark-text hover:bg-white dark:hover:bg-dark-surface disabled:opacity-30 disabled:cursor-not-allowed transition shadow-xs"
              title="Sonraki Kombinasyon"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <select
            aria-label="Kombinasyon sıralaması"
            value={comboSort}
            onChange={(e) => setComboSort(e.target.value)}
            className="px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-dark-text bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl focus:outline-none focus:ring-1 focus:ring-cankaya-blue"
          >
            <option value="default">Varsayılan sıra</option>
            <option value="fewest_days">En az gün</option>
            <option value="latest_start">En geç başlangıç</option>
            <option value="earliest_end">En erken bitiş</option>
          </select>

          {/* Credits and ECTS for the selected combination or basket estimate */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-dark-subtext bg-slate-50 dark:bg-dark-card/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-dark-border">
            {currentCombo && !isScheduleStale ? (
              <>
                <span>{currentCombo.total_credits} Kredi</span>
                <span>•</span>
                <span>{currentCombo.total_ects} AKTS</span>
                <span>•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{currentCombo.days_count} Gün</span>
              </>
            ) : (
              <>
                <span>{basketTotalCredits} Kredi</span>
                <span>•</span>
                <span>{basketTotalEcts} AKTS</span>
                <span className="text-slate-400 dark:text-dark-subtext font-normal">(Sepet toplamı)</span>
              </>
            )}
          </div>

          {isGenerating && (
            <span role="status" className="text-xs text-cankaya-blue dark:text-cankaya-gold font-medium animate-pulse flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-cankaya-blue dark:bg-cankaya-gold animate-ping" />
              Hesaplanıyor…
            </span>
          )}
        </div>

        {/* Preferences Toggles */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
          <span className="text-slate-400 dark:text-dark-subtext flex items-center gap-1 font-semibold uppercase text-[10px] tracking-wider">
            <Sliders className="w-3 h-3 text-cankaya-blue dark:text-cankaya-gold" />
            Tercihler:
          </span>

          <label className="flex items-center gap-1.5 text-slate-700 dark:text-dark-text cursor-pointer select-none">
            <input
              type="checkbox"
              checked={preferences.no_morning}
              onChange={(e) => updatePreferences({ no_morning: e.target.checked })}
              className="rounded border-slate-300 dark:border-dark-border text-cankaya-blue focus:ring-cankaya-blue w-3.5 h-3.5"
            />
            <span>Sabah Dersi Yok (&lt;10:00)</span>
          </label>

          <label className="flex items-center gap-1.5 text-slate-700 dark:text-dark-text cursor-pointer select-none">
            <span>Boş gün</span>
            <select
              aria-label="Boş gün tercihi"
              value={Object.entries({
                free_monday: 'Pazartesi', free_tuesday: 'Salı', free_wednesday: 'Çarşamba',
                free_thursday: 'Perşembe', free_friday: 'Cuma'
              }).find(([key]) => preferences[key])?.[0] || ''}
              onChange={(e) => updatePreferences({
                free_monday: false, free_tuesday: false, free_wednesday: false,
                free_thursday: false, free_friday: false,
                ...(e.target.value ? { [e.target.value]: true } : {})
              })}
              className="rounded-lg border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card px-2 py-1.5"
            >
              <option value="">Yok</option>
              <option value="free_monday">Pazartesi</option>
              <option value="free_tuesday">Salı</option>
              <option value="free_wednesday">Çarşamba</option>
              <option value="free_thursday">Perşembe</option>
              <option value="free_friday">Cuma</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-slate-700 dark:text-dark-text cursor-pointer select-none">
            <input
              type="checkbox"
              checked={preferences.no_lunch_break}
              onChange={(e) => updatePreferences({ no_lunch_break: e.target.checked })}
              className="rounded border-slate-300 dark:border-dark-border text-cankaya-blue focus:ring-cankaya-blue w-3.5 h-3.5"
            />
            <span>Öğle Arası Boş (12:00–14:00)</span>
          </label>
        </div>

      </div>

      {untimedCodes.length > 0 && (
        <p className="text-xs text-slate-600 dark:text-dark-subtext">
          Haftalık saati olmayan dersler: {untimedCodes.join(', ')}. AKTS toplamına dahildir.
        </p>
      )}

      {/* Conflict / Warning Notice if count is 0 */}
      {conflictsInfo && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{conflictsInfo}</p>
        </div>
      )}
      {conflictDetails.length > 0 && <ul className="space-y-2" aria-label="Çakışma nedenleri ve çözümler">
        {conflictDetails.map((detail, index) => <li key={index} className="rounded-xl border border-slate-200 dark:border-dark-border p-3 text-sm">
          <p>{detail.message}</p>
          {detail.action && <button disabled={isGenerating} onClick={() => applyFix(detail.action)} className="mt-2 rounded-lg px-3 py-2 bg-slate-100 dark:bg-dark-card font-semibold">{detail.action.label}</button>}
        </li>)}
      </ul>}

    </div>
  );
}
