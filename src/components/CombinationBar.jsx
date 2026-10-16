import React from 'react';
import { useSchedule } from '../context/useSchedule';
import {
  ChevronLeft,
  ChevronRight,
  Sliders,
  AlertTriangle,
  RefreshCw,
  ChevronDown
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
    <div className="bg-surface rounded-2xl border border-border-subtle p-3 sm:p-4 space-y-3 transition-colors">
      {/* Alert & Status Notifications */}
      {generationError && (
        <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 p-3 text-xs sm:text-sm text-rose-700 dark:text-rose-300">
          <p className="font-medium">{generationError}</p>
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => generateSchedule()}
            className="underline mt-1 font-semibold hover:text-rose-900 dark:hover:text-rose-200"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {isScheduleStale && (
        <p role="status" className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 p-3 text-xs sm:text-sm text-amber-800 dark:text-amber-300 font-medium">
          Gösterilen program güncel seçimlere ait değil. Yeni sonuç gelene kadar dışa aktarılamaz.
        </p>
      )}

      {storageError && (
        <p role="status" className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 p-3 text-xs sm:text-sm text-amber-800 dark:text-amber-300 font-medium">
          {storageError}
        </p>
      )}

      {restoredPlan && (
        <p role="status" className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 p-3 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 font-medium">
          Program dosyası yüklendi. Güncel ders verileriyle kontrol etmek için yeniden program oluşturabilirsiniz.
        </p>
      )}

      {/* Primary Toolbar: Title, Pagination Controls, Sorting, and Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left Side: Counter & Pagination */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Stepper with 44px touch targets */}
          <div className="flex items-center bg-surface-muted/60 rounded-xl p-0.5 border border-border-subtle">
            <button
              type="button"
              onClick={handlePrev}
              disabled={totalCombos === 0 || currentComboIndex === 0}
              className="min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-lg text-ink hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Önceki Kombinasyon"
              aria-label="Önceki kombinasyon"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 text-xs font-mono font-bold text-ink select-none tabular-nums">
              {totalCombos > 0 ? (
                <span>
                  {String(currentComboIndex + 1).padStart(2, '0')}{' '}
                  <span className="text-ink-muted font-sans font-normal">/ {String(totalCombos).padStart(2, '0')}</span>
                </span>
              ) : (
                <span className="text-ink-muted font-sans font-normal">00 / 00</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleNext}
              disabled={totalCombos === 0 || currentComboIndex >= totalCombos - 1}
              className="min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-lg text-ink hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Sonraki Kombinasyon"
              aria-label="Sonraki kombinasyon"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Sort Selector */}
          <select
            aria-label="Kombinasyon sıralaması"
            value={comboSort}
            onChange={(e) => setComboSort(e.target.value)}
            className="px-2.5 py-2 text-xs font-medium text-ink bg-surface-muted/60 border border-border-subtle rounded-xl focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
          >
            <option value="default">Varsayılan sıra</option>
            <option value="fewest_days">En az gün</option>
            <option value="latest_start">En geç başlangıç</option>
            <option value="earliest_end">En erken bitiş</option>
          </select>

          {/* Semantic Summary Metrics */}
          <dl
            data-schedule-metrics
            className="flex items-center gap-2 text-xs font-medium text-ink bg-surface-muted/60 px-3 py-1.5 rounded-xl border border-border-subtle"
          >
            {currentCombo && !isScheduleStale ? (
              <>
                <div className="flex items-center gap-1">
                  <dt className="sr-only">Toplam Kredi</dt>
                  <dd className="tabular-nums">{currentCombo.total_credits} Kredi</dd>
                </div>
                <span className="text-border-strong select-none">•</span>
                <div className="flex items-center gap-1">
                  <dt className="sr-only">Toplam AKTS</dt>
                  <dd className="tabular-nums">{currentCombo.total_ects} AKTS</dd>
                </div>
                <span className="text-border-strong select-none">•</span>
                <div className="flex items-center gap-1">
                  <dt className="sr-only">Ders Günleri</dt>
                  <dd className="text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">
                    {currentCombo.days_count} Gün
                  </dd>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <dt className="sr-only">Sepet Kredisi</dt>
                  <dd className="tabular-nums">{basketTotalCredits} Kredi</dd>
                </div>
                <span className="text-border-strong select-none">•</span>
                <div className="flex items-center gap-1">
                  <dt className="sr-only">Sepet AKTS</dt>
                  <dd className="tabular-nums">{basketTotalEcts} AKTS</dd>
                </div>
                <span className="text-ink-muted text-[11px] font-normal">(Sepet toplamı)</span>
              </>
            )}
          </dl>

          {/* Calculating state */}
          {isGenerating && (
            <span role="status" className="text-xs text-brand font-medium animate-pulse flex items-center gap-1.5 ml-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand" />
              <span>Hesaplanıyor…</span>
            </span>
          )}
        </div>
      </div>

      {/* Layered Progressive Disclosure: Preferences */}
      <details
        data-preferences-details
        open
        className="group border-t border-border-subtle pt-2.5 text-xs text-ink transition-colors"
      >
        <summary className="cursor-pointer font-medium select-none py-1 hover:text-ink flex items-center justify-between text-ink-muted">
          <span className="flex items-center gap-1.5 font-semibold text-xs text-ink">
            <Sliders className="w-3.5 h-3.5 text-brand" />
            <span>Program Tercihleri</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-ink-muted transition-transform group-open:rotate-180" />
        </summary>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2 pb-1 text-xs text-ink">
          <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-ink">
            <input
              type="checkbox"
              checked={preferences.no_morning}
              onChange={(e) => updatePreferences({ no_morning: e.target.checked })}
              className="rounded border-border-subtle text-ink focus:ring-brand w-3.5 h-3.5"
            />
            <span>Sabah Dersi Yok (&lt;10:00)</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-ink">
            <span className="text-ink-muted">Boş gün:</span>
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
              className="rounded-lg border border-border-subtle bg-surface px-2 py-1 text-xs text-ink focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
            >
              <option value="">Yok</option>
              <option value="free_monday">Pazartesi</option>
              <option value="free_tuesday">Salı</option>
              <option value="free_wednesday">Çarşamba</option>
              <option value="free_thursday">Perşembe</option>
              <option value="free_friday">Cuma</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-ink">
            <input
              type="checkbox"
              checked={preferences.no_lunch_break}
              onChange={(e) => updatePreferences({ no_lunch_break: e.target.checked })}
              className="rounded border-border-subtle text-ink focus:ring-brand w-3.5 h-3.5"
            />
            <span>Öğle Arası Boş (12:00–14:00)</span>
          </label>
        </div>
      </details>

      {/* Untimed courses footnote */}
      {untimedCodes.length > 0 && (
        <p className="text-xs text-ink-muted pt-1 border-t border-border-subtle/50">
          Haftalık saati olmayan dersler: {untimedCodes.join(', ')}. AKTS toplamına dahildir.
        </p>
      )}

      {/* Conflicts and Resolution List */}
      {conflictsInfo && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">{conflictsInfo}</p>
        </div>
      )}

      {conflictDetails.length > 0 && (
        <ul className="space-y-2 pt-1" aria-label="Çakışma nedenleri ve çözümler">
          {conflictDetails.map((detail, index) => (
            <li
              key={index}
              className="rounded-xl border border-border-subtle bg-surface-muted/40 p-3 text-xs sm:text-sm text-ink space-y-2"
            >
              <p className="font-medium">{detail.message}</p>
              {detail.action && (
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => applyFix(detail.action)}
                  className="rounded-lg px-3 py-1.5 bg-surface border border-border-subtle text-ink font-semibold text-xs hover:bg-surface-muted transition-colors shadow-sm"
                >
                  {detail.action.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
