import React from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  Sliders, 
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export default function CombinationBar() {
  const {
    combinations,
    currentComboIndex,
    setCurrentComboIndex,
    preferences,
    updatePreferences,
    conflictsInfo
  } = useSchedule();

  const totalCombos = combinations.length;
  const currentCombo = totalCombos > 0 ? combinations[currentComboIndex] : null;

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
      
      {/* Top Row: Navigation and Preferences */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        
        {/* Navigation Controls */}
        <div className="flex items-center gap-2">
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

          {/* Quick Stats for current combination */}
          {currentCombo && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-dark-subtext bg-slate-50 dark:bg-dark-card/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-dark-border">
              <span>{currentCombo.total_credits} Kredi</span>
              <span>•</span>
              <span>{currentCombo.total_ects} AKTS</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{currentCombo.days_count} Gün</span>
            </div>
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
            <input
              type="checkbox"
              checked={preferences.free_friday}
              onChange={(e) => updatePreferences({ free_friday: e.target.checked })}
              className="rounded border-slate-300 dark:border-dark-border text-cankaya-blue focus:ring-cankaya-blue w-3.5 h-3.5"
            />
            <span>Cuma Günü Boş</span>
          </label>

          <label className="flex items-center gap-1.5 text-slate-700 dark:text-dark-text cursor-pointer select-none">
            <input
              type="checkbox"
              checked={preferences.free_monday}
              onChange={(e) => updatePreferences({ free_monday: e.target.checked })}
              className="rounded border-slate-300 dark:border-dark-border text-cankaya-blue focus:ring-cankaya-blue w-3.5 h-3.5"
            />
            <span>Pazartesi Boş</span>
          </label>
        </div>

      </div>

      {/* Conflict / Warning Notice if count is 0 */}
      {conflictsInfo && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{conflictsInfo}</p>
        </div>
      )}

    </div>
  );
}
