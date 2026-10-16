import React, { useState, useEffect, useCallback } from 'react';
import { useSchedule } from '../context/useSchedule';
import { fetchCourseDetail } from '../services/api';
import AppDialog from './AppDialog';
import {
  ExternalLink,
  MapPin,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Loader2,
  RefreshCw
} from 'lucide-react';

export default function CourseDetailModal() {
  const {
    courseDetailModalCode,
    setCourseDetailModalCode,
    profile,
    passedCodesString,
    basket,
    addToBasket,
    removeFromBasket
  } = useSchedule();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDetail = useCallback(() => {
    if (!courseDetailModalCode) {
      setDetail(null);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    fetchCourseDetail(courseDetailModalCode, {
      primary_dept: profile.primaryDept,
      secondary_dept: profile.secondaryDept,
      secondary_type: profile.secondaryType,
      passed_codes: passedCodesString
    })
      .then(data => {
        setDetail(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Ders detayı alınamadı.');
        setLoading(false);
      });
  }, [courseDetailModalCode, profile.primaryDept, profile.secondaryDept, profile.secondaryType, passedCodesString]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (!courseDetailModalCode) return null;

  const inBasket = !!(detail && basket[detail.code]);
  const isUnknown = detail?.prerequisites?.known === false;
  const canTake = isUnknown ? false : (detail?.prerequisites ? detail.prerequisites.can_take : detail?.can_take !== false);

  return (
    <AppDialog
      isOpen={Boolean(courseDetailModalCode)}
      onClose={() => setCourseDetailModalCode(null)}
      title={courseDetailModalCode}
      description={detail?.name || 'Ders detayları ve haftalık şube saatleri'}
      titleId="course-detail-title"
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full text-xs">
          <button
            type="button"
            onClick={() => setCourseDetailModalCode(null)}
            className="btn-secondary text-xs px-3.5 py-1.5 min-h-[36px]"
          >
            Kapat
          </button>

          {detail && (
            <button
              type="button"
              onClick={() => {
                if (inBasket) removeFromBasket(detail.code);
                else addToBasket(detail);
                setCourseDetailModalCode(null);
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition min-h-[36px] ${
                inBasket
                  ? 'btn-secondary text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                  : 'btn-primary'
              }`}
            >
              {inBasket ? (
                <>
                  <Minus className="w-3.5 h-3.5" />
                  <span>Çıkar</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ekle</span>
                </>
              )}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {loading ? (
          <div role="status" className="py-16 text-center text-ink-muted flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
            <span className="text-xs">Ders bilgileri yükleniyor...</span>
          </div>
        ) : error ? (
          <div role="alert" className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={loadDetail}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Tekrar Dene</span>
            </button>
          </div>
        ) : detail ? (
          <>
            {/* Quick Metrics Bar */}
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-surface-muted/60 border border-border-subtle">
                <dt className="text-[10px] text-ink-muted font-medium">Bölüm</dt>
                <dd className="font-mono font-bold text-ink text-sm">{detail.dept_code}</dd>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-muted/60 border border-border-subtle">
                <dt className="text-[10px] text-ink-muted font-medium">Yerel Kredi</dt>
                <dd className="font-mono font-bold text-ink text-sm tabular-nums">{detail.credit}</dd>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-muted/60 border border-border-subtle">
                <dt className="text-[10px] text-ink-muted font-medium">AKTS</dt>
                <dd className="font-mono font-bold text-ink text-sm tabular-nums">{detail.ects}</dd>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-muted/60 border border-border-subtle">
                <dt className="text-[10px] text-ink-muted font-medium">Açılan Şube</dt>
                <dd className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm tabular-nums">
                  {detail.sections?.length || 0}
                </dd>
              </div>
            </dl>

            {/* Prerequisites Card */}
            <div className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
              isUnknown
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                : canTake
                ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}>
              {canTake ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : isUnknown ? (
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-serif font-bold text-xs">
                  {isUnknown
                    ? 'Ön Koşul Bilgisi Doğrulanmadı'
                    : canTake
                    ? 'Ön Koşul Durumu: Alınabilir'
                    : 'Ön Koşul Uyarısı: Eksik Dersler Var'}
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  {detail.prerequisites?.message || (detail.prerequisites?.has_prereqs ? detail.prerequisites?.rule_description : 'Bu dersin herhangi bir ön koşulu bulunmamaktadır.')}
                </p>
                {detail.prerequisites?.source && (
                  <a className="text-[11px] underline text-ink-muted hover:text-ink inline-block" href={detail.prerequisites.source} target="_blank" rel="noreferrer">
                    Resmî müfredat{detail.prerequisites.curriculum ? ` (${detail.prerequisites.curriculum})` : ''}
                  </a>
                )}
              </div>
            </div>

            {/* Description / Syllabus */}
            <div>
              <span className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1.5">
                Ders Tanımı ve İçeriği
              </span>
              <div className="p-3 bg-surface-muted/50 rounded-xl border border-border-subtle text-ink leading-relaxed">
                {detail.description || 'Bu ders için detaylı katalog açıklaması henüz eklenmemiş.'}
              </div>
            </div>

            {/* Web Page Link */}
            <div className="flex items-center gap-2">
              <a
                href={detail.course_url || `https://${(detail.code || courseDetailModalCode).toLowerCase()}.cankaya.edu.tr`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-subtle bg-surface-muted hover:bg-surface text-ink text-xs font-semibold transition"
              >
                <ExternalLink className="w-3.5 h-3.5 text-brand" />
                <span>Resmi Ders Web Sitesi ({(detail.code || courseDetailModalCode).toLowerCase()}.cankaya.edu.tr)</span>
              </a>
            </div>

            {/* Sections Table */}
            <div>
              {detail.instructor_reference && detail.sections?.every(sec => !sec.instructor || sec.instructor === 'Belirsiz') && (
                <div className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200">
                  Ders sitesindeki kayıt: <strong>{detail.instructor_reference.name}</strong>.
                  {' '}{detail.instructor_reference.published_term || 'Dönem belirtilmemiş'}
                  {detail.instructor_reference.last_modified && ` · Sayfa güncellemesi: ${detail.instructor_reference.last_modified}`}.
                  {' '}Güncel şube ataması doğrulanamadı.
                  {' '}<a href={detail.instructor_reference.source} target="_blank" rel="noreferrer" className="underline">Kaynak</a>
                </div>
              )}
              <span className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1.5">
                Açılan Şubeler ve Haftalık Saatler
              </span>
              <div className="border border-border-subtle rounded-xl overflow-hidden divide-y divide-border-subtle bg-surface">
                {(!detail.sections || detail.sections.length === 0) && (
                  <p className="p-3 text-xs text-ink-muted">
                    {detail.untimed
                      ? 'Bu ders için haftalık saat bulunmuyor; programa eklenir ve AKTS toplamına katılır.'
                      : 'Bu ders için şube veya haftalık saat bilgisi bulunamadı.'}
                  </p>
                )}
                {detail.sections?.map(sec => (
                  <div key={sec.section_no} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-surface-muted/30 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-ink">
                          Şube {sec.section_no}
                        </span>
                        <span className="text-ink-muted flex items-center gap-1 text-xs">
                          <User className="w-3 h-3" />
                          {sec.instructor || 'Belirtilmemiş'}
                        </span>
                      </div>
                      {sec.instructor_evidence?.source && (
                        <a href={sec.instructor_evidence.source} target="_blank" rel="noreferrer" className="text-[10px] underline text-ink-muted hover:text-ink">
                          Resmî haftalık program · {sec.instructor_evidence.fetched_at?.slice(0, 10)}
                        </a>
                      )}
                      {sec.classroom && (
                        <div className="text-[11px] text-ink-muted flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          Derslik: {sec.classroom}
                        </div>
                      )}
                    </div>

                    <div className="text-right flex flex-wrap sm:flex-col gap-1 sm:gap-0.5">
                      {sec.slots?.map((s, i) => (
                        <span key={i} className="text-[11px] font-medium text-ink flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-brand" />
                          {s.day} {s.time_slot} {s.classroom ? `(${s.classroom})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </>
        ) : null}
      </div>
    </AppDialog>
  );
}
