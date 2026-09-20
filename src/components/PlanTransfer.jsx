import React, { useEffect, useRef, useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { buildCalendar, buildCSV, createPlan, downloadFile, validatePlan } from '../utils/plan';

export default function PlanTransfer({ mode, onClose, onRestored }) {
  const schedule = useSchedule();
  const dialogRef = useRef(null);
  const [dates, setDates] = useState(schedule.semester);
  const [activities, setActivities] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current.showModal();
    return () => previous?.focus();
  }, []);

  const readFile = async event => {
    const file = event.target.files?.[0];
    setCandidate(null);
    setError('');
    if (!file) return;
    setReading(true);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Program dosyası en fazla 2 MB olabilir.');
      setCandidate(validatePlan(JSON.parse(await file.text())));
    } catch (err) { setError(err instanceof SyntaxError ? 'Dosya geçerli JSON içermiyor.' : err.message); }
    finally { setReading(false); }
  };

  const save = () => {
    setError('');
    if (!schedule.canExport) { setError('Seçimler değişti. Önce programı yeniden oluşturun.'); return; }
    try {
      const plan = createPlan({ ...schedule, semester: dates });
      const content = mode === 'calendar' ? buildCalendar(plan, activities) : mode === 'csv' ? buildCSV(plan, activities) : JSON.stringify(plan, null, 2);
      const format = mode === 'calendar' ? { extension: 'ics', type: 'text/calendar;charset=utf-8' } :
        mode === 'csv' ? { extension: 'csv', type: 'text/csv;charset=utf-8' } : { extension: 'json', type: 'application/json' };
      downloadFile(content, `cankaya_program.${format.extension}`, format.type);
      schedule.setSemester(dates);
      onClose();
    } catch (err) { setError(err.message); }
  };

  return (
    <dialog ref={dialogRef} onCancel={onClose} aria-labelledby="transfer-title" className="w-[calc(100%_-_2rem)] max-w-lg rounded-2xl bg-white dark:bg-dark-surface text-slate-800 dark:text-dark-text p-6 shadow-xl backdrop:bg-slate-900/60">
      <div className="flex justify-between gap-4 items-center mb-4">
        <h2 id="transfer-title" className="font-bold text-lg">{mode === 'load' ? 'Kayıtlı programı yükle' : mode === 'calendar' ? 'Takvime aktar' : mode === 'csv' ? 'CSV olarak indir' : 'Programı kaydet'}</h2>
        <button onClick={onClose} aria-label="Kapat" className="px-3 py-2 rounded-lg">✕</button>
      </div>
      {mode === 'load' ? <div className="space-y-4 text-sm">
        <p>Bu uygulamadan kaydettiğiniz program dosyasını seçin.</p>
        <input aria-label="Program JSON dosyası" type="file" accept=".json,application/json" onChange={readFile} disabled={reading} className="w-full" />
        {reading && <p role="status">Dosya okunuyor…</p>}
        {candidate && <div className="rounded-xl p-4 bg-slate-100 dark:bg-dark-card space-y-2">
          <p className="font-semibold">{candidate.program.primaryDept} · {Object.keys(candidate.basket).length} ders</p>
          <p>{candidate.selectedCombination ? 'Seçilen şubeler ve program geri yüklenecek.' : 'Ders sepeti yüklenecek; ardından program oluşturabilirsiniz.'}</p>
          {candidate.selectedCombination?.sections.map(s => <p key={s.course_code}>{s.course_code} · Şube {s.section_no}</p>)}
          <p>Mevcut sepet, tercihler ve etkinlikler bu dosyayla değiştirilecek. Transkriptiniz korunur.</p>
          <button className="primary-action" onClick={() => {
            try { schedule.restorePlan(candidate); onRestored(); onClose(); } catch (err) { setError(err.message); }
          }}>Programı yükle</button>
        </div>}
      </div> : <div className="space-y-4 text-sm">
        <p>{mode === 'calendar' ? 'Dersler seçtiğiniz tarih aralığında her hafta, İstanbul saatine göre eklenir. Tatiller otomatik çıkarılmaz.' : mode === 'csv' ? 'Seçili programın her ders saati ayrı bir satır olarak indirilir. Ders, şube, gün, saat, öğretim elemanı, derslik ve kredi bilgileri eklenir. Transkript ve notlar eklenmez.' : 'Seçili program, ders sepeti, tercihler ve kişisel etkinlikler kaydedilir. Transkript ve notlar dosyaya eklenmez.'}</p>
        {mode !== 'csv' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label>Dönem başlangıcı {mode === 'save' && '(isteğe bağlı)'}<input type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })} className="mt-1 w-full rounded-lg p-2 border bg-transparent" /></label>
          <label>Dönem bitişi<input type="date" value={dates.end} min={dates.start} onChange={e => setDates({ ...dates, end: e.target.value })} className="mt-1 w-full rounded-lg p-2 border bg-transparent" /></label>
        </div>}
        {(mode === 'calendar' || mode === 'csv') && <label className="flex items-center gap-2"><input type="checkbox" checked={activities} onChange={e => setActivities(e.target.checked)} />Kişisel etkinlikleri ve notlarını da ekle</label>}
        <button onClick={save} disabled={!schedule.canExport} className="primary-action">{mode === 'calendar' ? 'Takvim dosyasını indir' : mode === 'csv' ? 'CSV dosyasını indir' : 'JSON dosyasını indir'}</button>
      </div>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
    </dialog>
  );
}
