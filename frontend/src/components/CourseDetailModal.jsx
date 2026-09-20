import React, { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { fetchCourseDetail } from '../services/api';
import { 
  X, 
  ExternalLink, 
  BookOpen, 
  MapPin, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  Check
} from 'lucide-react';

export default function CourseDetailModal() {
  const {
    courseDetailModalCode,
    setCourseDetailModalCode,
    profile,
    passedCodesString,
    basket,
    addToBasket
  } = useSchedule();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!courseDetailModalCode) {
      setDetail(null);
      return;
    }

    setLoading(true);
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
        console.error('Ders detayı alınamadı:', err);
        setLoading(false);
      });
  }, [courseDetailModalCode, profile.primaryDept, profile.secondaryDept, profile.secondaryType, passedCodesString]);

  if (!courseDetailModalCode) return null;

  const inBasket = !!(detail && basket[detail.code]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-dark-border overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 bg-slate-50 dark:bg-dark-card border-b border-slate-200 dark:border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cankaya-blue text-cankaya-gold flex items-center justify-center font-bold text-xs shadow-xs">
              {courseDetailModalCode.slice(0, 4)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-dark-text">
                  {courseDetailModalCode}
                </h3>
                {detail && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cankaya-blue/10 text-cankaya-blue dark:bg-cankaya-gold/20 dark:text-cankaya-gold">
                    {detail.type_label}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-dark-subtext">
                {detail?.name || 'Ders Detayı'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setCourseDetailModalCode(null)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {loading || !detail ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-cankaya-blue border-t-transparent rounded-full animate-spin" />
              <span>Ders bilgileri yükleniyor...</span>
            </div>
          ) : (
            <>
              {/* Quick Info Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border">
                  <div className="text-[10px] text-slate-400">Bölüm</div>
                  <div className="font-bold text-slate-800 dark:text-dark-text">{detail.dept_code}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border">
                  <div className="text-[10px] text-blue-500 font-semibold">Yerel Kredi</div>
                  <div className="font-bold text-blue-600 dark:text-blue-400">{detail.credit}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border">
                  <div className="text-[10px] text-purple-500 font-semibold">AKTS</div>
                  <div className="font-bold text-purple-600 dark:text-purple-400">{detail.ects}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border">
                  <div className="text-[10px] text-emerald-500 font-semibold">Açılan Şube</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">{detail.sections.length}</div>
                </div>
              </div>

              {/* Prerequisites Card */}
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                detail.prerequisites?.can_take
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-300'
                  : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-300'
              }`}>
                {detail.prerequisites?.can_take ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-xs">
                    {detail.prerequisites?.can_take ? 'Ön Koşul Durumu: Alınabilir' : 'Ön Koşul Uyarısı: Eksik Dersler Var'}
                  </div>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    {detail.prerequisites?.message || (detail.prerequisites?.has_prereqs ? detail.prerequisites?.rule_description : 'Bu dersin herhangi bir ön koşulu bulunmamaktadır.')}
                  </p>
                </div>
              </div>

              {/* Description / Syllabus */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-dark-subtext uppercase tracking-wider mb-1.5">
                  Ders Tanımı ve İçeriği
                </label>
                <div className="p-3 bg-slate-50 dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border text-slate-700 dark:text-dark-subtext leading-relaxed">
                  {detail.description || 'Bu ders için detaylı katalog açıklaması henüz eklenmemiş.'}
                </div>
              </div>

              {/* Web Page Link */}
              <div className="flex items-center gap-2">
                <a
                  href={detail.course_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-dark-card hover:bg-slate-200 dark:hover:bg-slate-700 text-cankaya-blue dark:text-cankaya-gold font-semibold transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Resmi Ders Web Sitesi ({detail.code.toLowerCase()}.cankaya.edu.tr)</span>
                </a>
              </div>

              {/* Sections Table */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-dark-subtext uppercase tracking-wider mb-1.5">
                  Açılan Şubeler ve Haftalık Saatler
                </label>
                <div className="border border-slate-200 dark:border-dark-border rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-dark-border">
                  {detail.sections.map(sec => (
                    <div key={sec.section_no} className="p-2.5 bg-white dark:bg-dark-surface flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-dark-text">
                            Section {sec.section_no}
                          </span>
                          <span className="text-slate-500 dark:text-dark-subtext flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {sec.instructor}
                          </span>
                        </div>
                        {sec.classroom && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            Derslik: {sec.classroom}
                          </div>
                        )}
                      </div>

                      <div className="text-right flex flex-wrap sm:flex-col gap-1 sm:gap-0.5">
                        {sec.slots.map((s, i) => (
                          <span key={i} className="text-[11px] font-medium text-slate-600 dark:text-dark-subtext flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {s.day} {s.time_slot} {s.classroom ? `(${s.classroom})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-dark-card border-t border-slate-200 dark:border-dark-border flex items-center justify-between">
          <button
            onClick={() => setCourseDetailModalCode(null)}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-dark-subtext hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition text-xs"
          >
            Kapat
          </button>

          {detail && (
            <button
              onClick={() => {
                addToBasket(detail);
                setCourseDetailModalCode(null);
              }}
              disabled={inBasket}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold shadow-md transition ${
                inBasket
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-default'
                  : 'bg-cankaya-blue hover:bg-cankaya-navy text-cankaya-gold active:scale-95'
              }`}
            >
              {inBasket ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Ders Sepette</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Sepete Ekle</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
