import React, { useState, useEffect } from 'react';
import { useSchedule } from '../context/useSchedule';
import { parseTranscriptText, uploadTranscriptFile, fetchCurriculumProgress } from '../services/api';
import { 
  X, 
  Upload, 
  Clipboard, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  BookOpen, 
  FileText,
  AlertCircle,
  TrendingUp
} from 'lucide-react';

const GRADES = ["AA", "BA", "BB", "CB", "CC", "DC", "DD", "S", "EX"];

export default function TranscriptModal() {
  const {
    transcriptModalOpen,
    setTranscriptModalOpen,
    profile,
    updateProfile,
    addPassedCourse,
    removePassedCourse
  } = useSchedule();

  const [activeTab, setActiveTab] = useState('paste'); // 'paste' | 'upload'
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Manual course add input
  const [manualCode, setManualCode] = useState('');
  const [manualGrade, setManualGrade] = useState('CC');

  // Curriculum progress
  const [progress, setProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [progressRetry, setProgressRetry] = useState(0);

  // Fetch progress whenever profile passedCourses changes
  useEffect(() => {
    let cancelled = false;
    setProgress(null);
    setProgressError('');
    setProgressLoading(true);
    fetchCurriculumProgress(profile.primaryDept, profile.passedCourses)
      .then(data => {
        if (!cancelled) setProgress(data);
      })
      .catch(err => {
        if (!cancelled) setProgressError(err.message || 'Kredi bilgisi yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setProgressLoading(false);
      });
    return () => { cancelled = true; };
  }, [profile.primaryDept, profile.passedCourses, progressRetry]);

  if (!transcriptModalOpen) return null;

  // Handle parsing text
  const handleParseText = async () => {
    if (!pasteText.trim()) {
      setErrorMsg('Lütfen Oasis transkript metnini yapıştırın.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await parseTranscriptText(pasteText);
      applyParsedData(res);
    } catch (err) {
      setErrorMsg(err.message || 'Transkript ayrıştırılamadı.');
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await uploadTranscriptFile(file);
      applyParsedData(res);
    } catch (err) {
      setErrorMsg(err.message || 'Dosya işlenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const applyParsedData = (res) => {
    const updates = {};
    if (res.primary_dept && res.primary_dept !== 'YOK') {
      updates.primaryDept = res.primary_dept;
    }
    if (res.secondary_type && res.secondary_type !== 'YOK') {
      updates.secondaryType = res.secondary_type;
    }
    if (res.secondary_dept && res.secondary_dept !== 'YOK') {
      updates.secondaryDept = res.secondary_dept;
    }

    // A newer attempt can change a course's status. Keep unrelated manual entries.
    const passed = { ...profile.passedCourses };
    const failed = { ...profile.failedCourses };
    const pending = { ...profile.pendingCourses };
    for (const course of res.all_detected_courses || []) {
      delete passed[course.code];
      delete failed[course.code];
      delete pending[course.code];
    }
    updates.passedCourses = { ...passed, ...(res.passed_courses || {}) };
    updates.failedCourses = { ...failed, ...(res.failed_courses || {}) };
    updates.pendingCourses = { ...pending, ...(res.pending_courses || {}) };
    if (Object.keys(updates.passedCourses).length > 0) updates.hidePassedCourses = true;

    updateProfile(updates);
    const count = Object.keys(res.passed_courses || {}).length;
    const failedCount = Object.keys(res.failed_courses || {}).length;
    const pendingCount = Object.keys(res.pending_courses || {}).length;
    setSuccessMsg(`${count} tamamlanan/muaf ders ve ${failedCount} başarısız/çekilmiş ders aktarıldı.${pendingCount ? ` ${pendingCount} ders henüz tamamlanmamış.` : ''}`);
    setPasteText('');
  };

  const handleAddManual = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    addPassedCourse(manualCode.trim(), manualGrade);
    setManualCode('');
  };

  const passedList = Object.values(profile.passedCourses || {});
  const completedCourses = Math.max(0, Number(progress?.compulsory_passed) || 0);
  const totalCourses = Math.max(0, Number(progress?.compulsory_total) || 0);
  const completedCredits = progress ? Number(progress.completed_credits) : null;
  const totalCredits = progress ? Number(progress.total_credits) : null;
  const progressMetrics = [
    {
      key: 'courses',
      label: 'Ders ilerlemesi',
      completed: completedCourses,
      total: totalCourses,
      unit: 'ders',
      strokeClass: 'text-cankaya-blue dark:text-cankaya-gold',
    },
    {
      key: 'credits',
      label: 'Kredi ilerlemesi',
      completed: completedCredits,
      total: totalCredits,
      unit: 'kredi',
      strokeClass: 'text-violet-600 dark:text-violet-400',
    },
  ].map(metric => {
    const ratio = metric.total > 0 ? Math.min(metric.completed / metric.total, 1) : 0;
    return {
      ...metric,
      percentage: Math.round(ratio * 100),
      offset: 2 * Math.PI * 48 * (1 - ratio),
      summary: `${metric.completed} / ${metric.total} ${metric.unit} tamamlandı (${Math.round(ratio * 100)}%).`,
    };
  });
  const ringRadius = 48;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="transcript-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-dark-border overflow-hidden flex flex-col">

        {/* Header */}
        <div className="p-4 bg-slate-50 dark:bg-dark-card border-b border-slate-200 dark:border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cankaya-blue/10 dark:bg-cankaya-gold/15 text-cankaya-blue dark:text-cankaya-gold flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 id="transcript-modal-title" className="text-sm font-bold text-slate-900 dark:text-dark-text">
                Transkript & Ön Koşul Yönetimi
              </h3>
              <p className="text-xs text-slate-500 dark:text-dark-subtext">
                Oasis transkriptinizi yapıştırarak verdiğiniz dersleri sisteme aktarın.
              </p>
            </div>
          </div>

          <button
            onClick={() => setTranscriptModalOpen(false)}
            aria-label="Kapat"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          
          {/* Degree Progress Card */}
          {progressLoading && (
            <div role="status" className="p-3 bg-slate-50 dark:bg-dark-card/60 rounded-xl border border-slate-200 dark:border-dark-border text-slate-500 dark:text-dark-subtext">
              Müfredat ilerlemesi yükleniyor…
            </div>
          )}

          {!progressLoading && progressError && (
            <div role="alert" className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
              <span>Kredi bilgisi yüklenemedi. {progressError}</span>
              <button
                type="button"
                onClick={() => setProgressRetry(value => value + 1)}
                className="shrink-0 rounded-lg border border-amber-300 px-2.5 py-1 font-semibold hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40"
              >
                Tekrar dene
              </button>
            </div>
          )}

          {progress && (
            <div className="p-3 bg-slate-50 dark:bg-dark-card/60 rounded-xl border border-slate-200 dark:border-dark-border space-y-2">
              <div className="flex items-center">
                <span className="font-bold text-slate-700 dark:text-dark-text flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  {progress.program_name || profile.primaryDept} Müfredat İlerlemesi
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-2">
                {progressMetrics.map(metric => (
                  <figure key={metric.key} className="flex flex-col items-center rounded-xl bg-white/70 p-3 dark:bg-dark-surface/50">
                    <figcaption className="mb-2 text-xs font-semibold text-slate-700 dark:text-dark-text">
                      {metric.label}
                    </figcaption>
                    <svg
                      width="120"
                      height="120"
                      viewBox="0 0 120 120"
                      role="img"
                      aria-label={metric.summary}
                      className="shrink-0"
                    >
                      <circle
                        cx="60"
                        cy="60"
                        r={ringRadius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="12"
                        className="text-slate-200 dark:text-slate-700"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r={ringRadius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={metric.offset}
                        transform="rotate(-90 60 60)"
                        className={`${metric.strokeClass} transition-[stroke-dashoffset] duration-500`}
                      >
                        <title>{metric.summary}</title>
                      </circle>
                      <text
                        x="60"
                        y="57"
                        textAnchor="middle"
                        className="fill-slate-900 text-lg font-bold dark:fill-dark-text"
                      >
                        {metric.percentage}%
                      </text>
                      <text
                        x="60"
                        y="75"
                        textAnchor="middle"
                        className="fill-slate-500 text-[10px] dark:fill-dark-subtext"
                      >
                        tamamlandı
                      </text>
                    </svg>
                    <p className="mt-2 text-sm font-bold text-slate-800 dark:text-dark-text">
                      {metric.completed} / {metric.total} {metric.unit}
                    </p>
                    <span className="sr-only">{metric.summary}</span>
                  </figure>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-dark-subtext pt-1">
                <span>Teknik Seçmeli: {progress.tech_slots_passed} / {progress.tech_slots_total}</span>
                <span>Sosyal/Serbest Seçmeli: {progress.social_slots_passed} / {progress.social_slots_total}</span>
              </div>
            </div>
          )}

          {/* Import Modes Tabs */}
          <div className="flex border-b border-slate-200 dark:border-dark-border">
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex items-center gap-1.5 px-4 py-2 border-b-2 font-semibold transition ${
                activeTab === 'paste'
                  ? 'border-cankaya-blue text-cankaya-blue dark:border-cankaya-gold dark:text-cankaya-gold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-dark-subtext'
              }`}
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Oasis Metin Yapıştır</span>
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 px-4 py-2 border-b-2 font-semibold transition ${
                activeTab === 'upload'
                  ? 'border-cankaya-blue text-cankaya-blue dark:border-cankaya-gold dark:text-cankaya-gold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-dark-subtext'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Transkript Dosyası Yükle (.PDF / .TXT)</span>
            </button>
          </div>

          {/* Tab 1: Paste Text */}
          {activeTab === 'paste' && (
            <div className="space-y-2">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Oasis transkript sayfasındaki tüm metni kopyalayıp (Ctrl+A, Ctrl+C) buraya yapıştırın..."
                rows={5}
                className="w-full p-2.5 bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl text-slate-800 dark:text-dark-text placeholder-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-cankaya-blue font-mono"
              />

              <button
                onClick={handleParseText}
                disabled={loading || !pasteText.trim()}
                className="w-full py-2 bg-cankaya-blue hover:bg-cankaya-navy text-cankaya-gold font-semibold rounded-xl disabled:opacity-50 transition shadow-xs flex items-center justify-center gap-2"
              >
                {loading ? 'Ayrıştırılıyor...' : 'Transkripti Ayrıştır ve Aktar'}
              </button>
            </div>
          )}

          {/* Tab 2: Upload File */}
          {activeTab === 'upload' && (
            <div className="p-6 border-2 border-dashed border-slate-200 dark:border-dark-border rounded-xl text-center space-y-2 bg-slate-50/50 dark:bg-dark-card/30">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-xs text-slate-600 dark:text-dark-subtext">
                <label className="font-semibold text-cankaya-blue dark:text-cankaya-gold cursor-pointer hover:underline">
                  Dosya seçin
                  <input
                    type="file"
                    accept=".pdf,.txt,.html,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>{' '}
                veya buraya sürükleyin
              </div>
              <p className="text-[11px] text-slate-400">PDF, TXT, HTML veya JSON transkript dosyaları desteklenir</p>
            </div>
          )}

          {/* Notifications */}
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Manual Add Passed Course */}
          <div className="p-3 bg-slate-50 dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border space-y-2">
            <span className="font-semibold text-slate-700 dark:text-dark-text text-[11px] uppercase tracking-wider block">
              Manuel Ders Ekle
            </span>

            <form onSubmit={handleAddManual} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Örn: CENG161, MATH157..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-lg text-xs dark:text-white"
              />

              <select
                value={manualGrade}
                onChange={(e) => setManualGrade(e.target.value)}
                className="px-2 py-1.5 bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-lg text-xs dark:text-white font-semibold"
              >
                {GRADES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ekle</span>
              </button>
            </form>
          </div>

          {/* Passed Courses Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-700 dark:text-dark-text text-xs">
                Kayıtlı Verilen Dersler ({passedList.length})
              </span>
            </div>

            {passedList.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs border border-slate-200 dark:border-dark-border rounded-xl">
                Henüz kayıtlı verilen ders bulunmuyor.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                {passedList.map(c => (
                  <div
                    key={c.code}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border flex items-center justify-between gap-1 shadow-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-800 dark:text-dark-text">{c.code}</div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Not: {c.grade || 'CC'}
                      </div>
                    </div>

                    <button
                      onClick={() => removePassedCourse(c.code)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded"
                      title="Sil"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-dark-card border-t border-slate-200 dark:border-dark-border flex items-center justify-end">
          <button
            onClick={() => setTranscriptModalOpen(false)}
            className="px-5 py-2 bg-cankaya-blue hover:bg-cankaya-navy text-cankaya-gold text-xs font-semibold rounded-xl shadow-md transition"
          >
            Tamam
          </button>
        </div>

      </div>
    </div>
  );
}
