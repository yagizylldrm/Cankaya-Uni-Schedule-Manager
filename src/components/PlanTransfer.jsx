import React, { useState } from 'react';
import { useSchedule } from '../context/useSchedule';
import { buildCalendar, buildCSV, createPlan, downloadFile } from '../utils/plan';
import { migratePlan } from '../utils/drafts';
import AppDialog from './AppDialog';

export default function PlanTransfer({ mode, onClose, onRestored, restoreFocusRef }) {
  const schedule = useSchedule();
  const [dates, setDates] = useState(schedule.semester);
  const [activities, setActivities] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);

  const title = mode === 'load'
    ? 'Kayıtlı programı yükle'
    : mode === 'calendar'
    ? 'Takvime aktar'
    : mode === 'csv'
    ? 'CSV olarak indir'
    : 'Programı kaydet';

  const description = mode === 'load'
    ? 'Bu uygulamadan kaydettiğiniz JSON program dosyasını içe aktarın.'
    : mode === 'calendar'
    ? 'Dersleri haftalık takvim (.ics) dosyası olarak dışa aktarın.'
    : mode === 'csv'
    ? 'Ders programını elektronik tablo veya CSV olarak indirin.'
    : 'Mevcut programı, tercihleri ve etkinlikleri JSON olarak yedekleyin.';

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    setCandidate(null);
    setError('');
    if (!file) return;
    setReading(true);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Program dosyası en fazla 2 MB olabilir.');
      const plan = migratePlan(JSON.parse(await file.text()));
      if (!plan) throw new Error('Geçerli bir program dosyası seçin (sürüm 1).');
      setCandidate(plan);
    } catch (err) {
      setError(err instanceof SyntaxError ? 'Dosya geçerli JSON içermiyor.' : err.message);
    } finally {
      setReading(false);
    }
  };

  const save = () => {
    setError('');
    if (!schedule.canExport) {
      setError('Seçimler değişti. Önce programı yeniden oluşturun.');
      return;
    }
    try {
      const plan = createPlan({ ...schedule, semester: dates });
      const content = mode === 'calendar'
        ? buildCalendar(plan, activities)
        : mode === 'csv'
        ? buildCSV(plan, activities)
        : JSON.stringify(plan, null, 2);

      const format = mode === 'calendar'
        ? { extension: 'ics', type: 'text/calendar;charset=utf-8' }
        : mode === 'csv'
        ? { extension: 'csv', type: 'text/csv;charset=utf-8' }
        : { extension: 'json', type: 'application/json' };

      downloadFile(content, `cankaya_program.${format.extension}`, format.type);
      schedule.setSemester(dates);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <AppDialog
      isOpen={true}
      onClose={onClose}
      title={title}
      description={description}
      restoreFocusRef={restoreFocusRef}
      size="md"
    >
      {mode === 'load' ? (
        <div className="space-y-4 text-sm">
          <p className="text-ink-muted">
            Bu uygulamadan kaydettiğiniz program dosyasını seçin.
          </p>
          <input
            aria-label="Program JSON dosyası"
            type="file"
            accept=".json,application/json"
            onChange={readFile}
            disabled={reading}
            className="w-full text-sm text-ink-muted file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-border-subtle file:bg-surface-muted file:text-ink file:font-medium hover:file:bg-surface file:cursor-pointer cursor-pointer"
          />
          {reading && <p role="status" className="text-ink-muted text-xs">Dosya okunuyor…</p>}
          {candidate && (
            <div className="rounded-xl p-4 bg-surface-muted border border-border-subtle space-y-2">
              <p className="font-semibold text-ink">
                {candidate.program.primaryDept} · {Object.keys(candidate.basket).length} ders
              </p>
              <p className="text-ink-muted text-xs">
                {candidate.selectedCombination
                  ? 'Seçilen şubeler ve program geri yüklenecek.'
                  : 'Ders seçimleri yüklenecek; ardından program oluşturabilirsiniz.'}
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {candidate.selectedCombination?.sections.map((s) => (
                  <p key={s.course_code} className="text-xs text-ink font-mono">
                    {s.course_code}
                    {candidate.basket[s.course_code]?.untimed
                      ? ' · Haftalık ders saati yok'
                      : ` · Şube ${s.section_no}`}
                  </p>
                ))}
              </div>
              <p className="text-xs text-ink-muted border-t border-border-subtle pt-2">
                Mevcut ders seçimleri, tercihler ve etkinlikler bu dosyayla değiştirilecek. Transkriptiniz korunur.
              </p>
              <button
                type="button"
                className="primary-action w-full mt-2"
                onClick={() => {
                  try {
                    schedule.restorePlan(candidate);
                    onRestored();
                    onClose();
                  } catch (err) {
                    setError(err.message);
                  }
                }}
              >
                Programı yükle
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-ink-muted leading-relaxed">
            {mode === 'calendar'
              ? 'Dersler seçtiğiniz tarih aralığında her hafta, İstanbul saatine göre eklenir. Tatiller otomatik çıkarılmaz.'
              : mode === 'csv'
              ? 'Seçili programın her ders saati ayrı bir satır olarak indirilir. Ders, şube, gün, saat, öğretim elemanı, derslik ve kredi bilgileri eklenir. Transkript ve notlar eklenmez.'
              : 'Seçili program, ders seçimleri, tercihler ve kişisel etkinlikler kaydedilir. Transkript ve notlar dosyaya eklenmez.'}
          </p>

          {mode !== 'csv' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="block text-xs font-medium text-ink-muted">
                Dönem başlangıcı {mode === 'save' && '(isteğe bağlı)'}
                <input
                  type="date"
                  value={dates.start}
                  onChange={(e) => setDates({ ...dates, start: e.target.value })}
                  className="mt-1 w-full rounded-lg p-2.5 border border-border-subtle bg-surface text-ink text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-ink-muted">
                Dönem bitişi
                <input
                  type="date"
                  value={dates.end}
                  min={dates.start}
                  onChange={(e) => setDates({ ...dates, end: e.target.value })}
                  className="mt-1 w-full rounded-lg p-2.5 border border-border-subtle bg-surface text-ink text-sm"
                />
              </label>
            </div>
          )}

          {(mode === 'calendar' || mode === 'csv') && (
            <label className="flex items-center gap-2.5 pt-1 text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={activities}
                onChange={(e) => setActivities(e.target.checked)}
                className="w-4 h-4 rounded border-border-subtle text-brand focus:ring-brand"
              />
              <span className="text-xs sm:text-sm">Kişisel etkinlikleri ve notlarını da ekle</span>
            </label>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={save}
              disabled={!schedule.canExport}
              className="primary-action w-full"
            >
              {mode === 'calendar'
                ? 'Takvim dosyasını indir'
                : mode === 'csv'
                ? 'CSV dosyasını indir'
                : 'JSON dosyasını indir'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-xs sm:text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/50">
          {error}
        </p>
      )}
    </AppDialog>
  );
}
