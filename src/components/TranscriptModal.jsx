import React, { useState, useEffect } from 'react';
import { useSchedule } from '../context/useSchedule';
import { parseTranscriptText, uploadTranscriptFile, fetchCurriculumProgress } from '../services/api';
import AppDialog from './AppDialog';
import {
  Upload,
  Clipboard,
  CheckCircle2,
  Trash2,
  Plus,
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

    if (pasteText.length > 500000) {
      setErrorMsg('Transkript metni çok uzun (en fazla 500.000 karakter).');
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

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Dosya boyutu çok büyük. Lütfen en fazla 5 MB boyutunda bir dosya yükleyin.');
      return;
    }

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
    },
    {
      key: 'credits',
      label: 'Kredi ilerlemesi',
      completed: completedCredits,
      total: totalCredits,
      unit: 'kredi',
    },
  ].map(metric => {
    const ratio = metric.total > 0 ? Math.min(metric.completed / metric.total, 1) : 0;
    const percentage = Math.round(ratio * 100);
    return {
      ...metric,
      percentage,
      summary: `${metric.completed} / ${metric.total} ${metric.unit} tamamlandı (${percentage}%).`,
    };
  });

  return (
    <AppDialog
      isOpen={transcriptModalOpen}
      onClose={() => setTranscriptModalOpen(false)}
      title="Transkript & Ön Koşul Yönetimi"
      description="Oasis transkriptinizi yapıştırarak verdiğiniz dersleri sisteme aktarın."
      titleId="transcript-modal-title"
      size="lg"
      footer={
        <div className="flex items-center justify-end w-full">
          <button
            type="button"
            onClick={() => setTranscriptModalOpen(false)}
            className="btn-primary text-xs"
          >
            Tamam
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Degree Progress Section */}
        {progressLoading && (
          <div role="status" className="p-3 bg-surface-muted/50 rounded-xl border border-border-subtle text-ink-muted animate-pulse">
            Müfredat ilerlemesi yükleniyor…
          </div>
        )}

        {!progressLoading && progressError && (
          <div role="alert" className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
            <span>Kredi bilgisi yüklenemedi. {progressError}</span>
            <button
              type="button"
              onClick={() => setProgressRetry(value => value + 1)}
              className="shrink-0 rounded-lg border border-amber-300 dark:border-amber-700 px-2.5 py-1 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              Tekrar dene
            </button>
          </div>
        )}

        {progress && (
          <div className="p-4 bg-surface-muted/50 rounded-2xl border border-border-subtle space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand" />
              <span className="font-serif font-bold text-sm text-ink">
                {progress.program_name || profile.primaryDept} Müfredat İlerlemesi
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {progressMetrics.map(metric => (
                <div key={metric.key} className="p-3 bg-surface rounded-xl border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink">{metric.label}</span>
                    <span className="font-bold text-ink tabular-nums">
                      {metric.completed} / {metric.total} {metric.unit}
                    </span>
                  </div>

                  <progress
                    value={metric.completed}
                    max={metric.total}
                    aria-label={metric.summary}
                    className="w-full h-2 rounded-full overflow-hidden bg-surface-muted [&::-webkit-progress-bar]:bg-surface-muted [&::-webkit-progress-value]:bg-brand [&::-moz-progress-bar]:bg-brand"
                  />

                  <div className="flex items-center justify-between text-[11px] text-ink-muted">
                    <span>{metric.summary}</span>
                    <span className="font-semibold text-ink tabular-nums">%{metric.percentage}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted pt-1 border-t border-border-subtle/60">
              <span className="tabular-nums">Teknik Seçmeli: <strong className="text-ink font-semibold">{progress.tech_slots_passed} / {progress.tech_slots_total}</strong></span>
              <span className="tabular-nums">Sosyal/Serbest Seçmeli: <strong className="text-ink font-semibold">{progress.social_slots_passed} / {progress.social_slots_total}</strong></span>
            </div>
          </div>
        )}

        {/* Import Modes Tabs */}
        <div className="flex border-b border-border-subtle">
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 font-semibold text-xs transition-colors ${
              activeTab === 'paste'
                ? 'border-brand text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Oasis Metin Yapıştır</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 font-semibold text-xs transition-colors ${
              activeTab === 'upload'
                ? 'border-brand text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Transkript Dosyası Yükle (.PDF / .TXT)</span>
          </button>
        </div>

        {/* Tab 1: Paste Text */}
        {activeTab === 'paste' && (
          <div className="space-y-2.5">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Oasis transkript sayfasındaki tüm metni kopyalayıp (Ctrl+A, Ctrl+C) buraya yapıştırın..."
              rows={5}
              className="w-full p-3 bg-surface border border-border-subtle rounded-xl text-ink placeholder:text-ink-muted text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-brand font-mono"
            />

            <button
              type="button"
              onClick={handleParseText}
              disabled={loading || !pasteText.trim()}
              className="w-full min-h-[44px] py-2.5 btn-primary disabled:opacity-40 transition shadow-sm flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold"
            >
              {loading ? 'Ayrıştırılıyor...' : 'Transkripti Ayrıştır ve Aktar'}
            </button>
          </div>
        )}

        {/* Tab 2: Upload File */}
        {activeTab === 'upload' && (
          <div className="p-6 border-2 border-dashed border-border-subtle rounded-2xl text-center space-y-2 bg-surface-muted/30">
            <FileText className="w-8 h-8 text-ink-muted mx-auto" />
            <div className="text-xs sm:text-sm text-ink">
              <label className="font-semibold text-brand underline cursor-pointer hover:opacity-80">
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
            <p className="text-[11px] text-ink-muted">PDF, TXT, HTML veya JSON transkript dosyaları desteklenir (en fazla 5 MB)</p>
          </div>
        )}

        {/* Notifications */}
        {errorMsg && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div role="status" className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Manual Add Passed Course */}
        <div className="p-3.5 bg-surface-muted/50 rounded-2xl border border-border-subtle space-y-2.5">
          <span className="font-bold text-ink text-xs block">
            Manuel Ders Ekle
          </span>

          <form onSubmit={handleAddManual} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Örn: CENG161, MATH157..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 min-w-[140px] px-3 py-2 bg-surface border border-border-subtle rounded-xl text-xs sm:text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand font-mono"
            />

            <select
              value={manualGrade}
              onChange={(e) => setManualGrade(e.target.value)}
              className="px-3 py-2 bg-surface border border-border-subtle rounded-xl text-xs sm:text-sm text-ink font-semibold focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {GRADES.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            <button
              type="submit"
              className="min-h-[40px] px-4 py-2 btn-secondary text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ekle</span>
            </button>
          </form>
        </div>

        {/* Passed Courses Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-ink text-xs">
              Kayıtlı Verilen Dersler ({passedList.length})
            </span>
          </div>

          {passedList.length === 0 ? (
            <div className="p-6 text-center text-ink-muted text-xs border border-dashed border-border-subtle rounded-xl bg-surface-muted/20">
              Henüz kayıtlı verilen ders bulunmuyor.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
              {passedList.map(c => (
                <div
                  key={c.code}
                  className="p-2.5 rounded-xl bg-surface border border-border-subtle flex items-center justify-between gap-1 shadow-sm"
                >
                  <div>
                    <div className="font-mono font-bold text-xs text-ink">{c.code}</div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                      Not: {c.grade || 'CC'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removePassedCourse(c.code)}
                    className="p-1.5 text-ink-muted hover:text-rose-600 rounded-lg transition-colors"
                    title="Sil"
                    aria-label={`${c.code} dersini sil`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppDialog>
  );
}
