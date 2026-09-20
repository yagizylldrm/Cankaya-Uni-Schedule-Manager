import React, { useState, useEffect, useMemo } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { fetchDepartments, fetchCourses, fetchCourseDetail } from '../services/api';
import { 
  Search, 
  Plus, 
  Check, 
  Info, 
  Filter, 
  Layers, 
  AlertCircle,
  BookOpen,
  UserCheck
} from 'lucide-react';

export default function CourseSearchPanel() {
  const {
    profile,
    updateProfile,
    basket,
    addToBasket,
    passedCodesString,
    setCourseDetailModalCode
  } = useSchedule();

  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search & Filter state
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedType, setSelectedType] = useState('TÜMÜ');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [hidePassed, setHidePassed] = useState(false);

  // Load departments once
  useEffect(() => {
    fetchDepartments()
      .then(data => setDepartments(data))
      .catch(err => console.error('Bölümler yüklenemedi:', err));
  }, []);

  // Fetch courses on filter/profile change
  useEffect(() => {
    let active = true;
    setLoading(true);

    const timer = setTimeout(() => {
      fetchCourses({
        query: searchQuery,
        dept: selectedDept,
        type: selectedType,
        primary_dept: profile.primaryDept,
        secondary_dept: profile.secondaryDept,
        secondary_type: profile.secondaryType,
        only_eligible: onlyEligible,
        hide_passed: hidePassed,
        passed_codes: passedCodesString
      })
        .then(data => {
          if (active) {
            setCourses(data);
            setLoading(false);
          }
        })
        .catch(err => {
          console.error('Dersler getirilirken hata:', err);
          if (active) setLoading(false);
        });
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    searchQuery,
    selectedDept,
    selectedType,
    profile.primaryDept,
    profile.secondaryDept,
    profile.secondaryType,
    onlyEligible,
    hidePassed,
    passedCodesString
  ]);

  // Handle adding course to basket
  const handleAddCourse = async (courseCode) => {
    try {
      const detail = await fetchCourseDetail(courseCode, {
        primary_dept: profile.primaryDept,
        secondary_dept: profile.secondaryDept,
        secondary_type: profile.secondaryType,
        passed_codes: passedCodesString
      });
      addToBasket(detail);
    } catch (err) {
      alert(`Ders sepete eklenirken hata: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-surface rounded-2xl border border-slate-200 dark:border-dark-border shadow-sm overflow-hidden">
      
      {/* 1. Student Profile (Bölüm & İkinci Dal) */}
      <div className="p-3.5 bg-slate-50/80 dark:bg-dark-card/50 border-b border-slate-200 dark:border-dark-border space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-dark-text uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5 text-cankaya-blue dark:text-cankaya-gold" />
          <span>Öğrenci Bölüm Bilgileri</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {/* Primary Major */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-dark-subtext mb-1">
              Ana Bölüm:
            </label>
            <select
              value={profile.primaryDept}
              onChange={(e) => updateProfile({ primaryDept: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-dark-surface border border-slate-300 dark:border-dark-border rounded-lg text-slate-800 dark:text-dark-text focus:ring-1 focus:ring-cankaya-blue font-medium"
            >
              {departments.map(d => (
                <option key={d.code} value={d.code}>{d.code} - {d.name}</option>
              ))}
            </select>
          </div>

          {/* Secondary Program Type */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-dark-subtext mb-1">
              İkinci Program:
            </label>
            <select
              value={profile.secondaryType}
              onChange={(e) => updateProfile({ secondaryType: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-dark-surface border border-slate-300 dark:border-dark-border rounded-lg text-slate-800 dark:text-dark-text focus:ring-1 focus:ring-cankaya-blue font-medium"
            >
              <option value="YOK">YOK (Tek Ana Dal)</option>
              <option value="CAP">🟣 Çift Anadal (ÇAP)</option>
              <option value="YANDAL">🔵 Yandal (Minor)</option>
            </select>
          </div>

          {/* Secondary Major Dept if applicable */}
          {profile.secondaryType !== 'YOK' && (
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-purple-600 dark:text-purple-400 mb-1">
                İkinci Program Bölümü:
              </label>
              <select
                value={profile.secondaryDept}
                onChange={(e) => updateProfile({ secondaryDept: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg text-slate-800 dark:text-dark-text focus:ring-1 focus:ring-purple-500 font-medium"
              >
                <option value="YOK">Bölüm Seçin...</option>
                {departments.filter(d => d.code !== profile.primaryDept).map(d => (
                  <option key={d.code} value={d.code}>{d.code} - {d.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 2. Filters & Search Inputs */}
      <div className="p-3.5 border-b border-slate-200 dark:border-dark-border space-y-2.5 bg-white dark:bg-dark-surface">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-dark-text uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-cankaya-blue dark:text-cankaya-gold" />
            Ders Filtreleme
          </span>
          <span className="text-[11px] font-normal text-slate-400">
            {courses.length} ders bulundu
          </span>
        </div>

        {/* Dept filter & Type filter */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-lg text-slate-800 dark:text-dark-text"
            >
              <option value="">Tüm Bölümler</option>
              {departments.map(d => (
                <option key={d.code} value={d.code}>{d.code}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-lg text-slate-800 dark:text-dark-text"
            >
              <option value="TÜMÜ">Tüm Türler</option>
              <option value="ZORUNLU">Tüm Zorunlular</option>
              <option value="ZORUNLU_ANA">🔹 Sadece Ana Zorunlu</option>
              {profile.secondaryType === 'CAP' && <option value="ZORUNLU_CAP">🟣 Sadece ÇAP Zorunlu</option>}
              {profile.secondaryType === 'YANDAL' && <option value="ZORUNLU_YANDAL">🔵 Sadece Yandal Zorunlu</option>}
              <option value="SECMELI">Tüm Seçmeliler</option>
              <option value="TEKNIK_SECMELI">🔹 Teknik Seçmeli</option>
              <option value="SERBEST_SECMELI">🔸 Sosyal / Serbest</option>
            </select>
          </div>
        </div>

        {/* Text Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Ders kodu veya öğretim elemanı ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-lg text-slate-800 dark:text-dark-text placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cankaya-blue"
          />
        </div>

        {/* Checkbox filters */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-600 dark:text-dark-subtext">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyEligible}
              onChange={(e) => setOnlyEligible(e.target.checked)}
              className="rounded border-slate-300 dark:border-dark-border text-cankaya-blue focus:ring-cankaya-blue w-3.5 h-3.5"
            />
            <span>🟢 Sadece Alabileceğim</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hidePassed}
              onChange={(e) => setHidePassed(e.target.checked)}
              className="rounded border-slate-300 dark:border-dark-border text-cankaya-blue focus:ring-cankaya-blue w-3.5 h-3.5"
            />
            <span>Verdiğim Dersleri Gizle</span>
          </label>
        </div>
      </div>

      {/* 3. Course Results List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 dark:text-dark-subtext flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-cankaya-blue border-t-transparent rounded-full animate-spin" />
            <span>Dersler taranıyor...</span>
          </div>
        ) : courses.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 dark:text-dark-subtext flex flex-col items-center gap-1.5">
            <BookOpen className="w-6 h-6 text-slate-300 dark:text-slate-600" />
            <span>Kriterlere uygun ders bulunamadı.</span>
          </div>
        ) : (
          courses.map(course => {
            const inBasket = !!basket[course.code];
            const isPassed = course.is_passed;

            // Badge styling according to type
            let badgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
            if (course.type === 'ZORUNLU') {
              badgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
            } else if (course.type === 'ZORUNLU_CAP') {
              badgeClass = 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
            } else if (course.type === 'ZORUNLU_YANDAL') {
              badgeClass = 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300';
            } else if (course.type === 'SERBEST_SECMELI') {
              badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
            }

            return (
              <div
                key={course.code}
                className="group p-2.5 rounded-xl border border-slate-200 dark:border-dark-border hover:border-cankaya-blue/50 dark:hover:border-cankaya-gold/50 bg-white dark:bg-dark-card/60 transition shadow-xs flex flex-col justify-between gap-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 dark:text-dark-text tracking-wide">
                        {course.code}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${badgeClass}`}>
                        {course.type_label}
                      </span>
                      {isPassed && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 flex items-center gap-0.5">
                          <UserCheck className="w-2.5 h-2.5" /> Geçildi
                        </span>
                      )}
                      {!course.can_take && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 flex items-center gap-0.5" title={course.prereq_message}>
                          <AlertCircle className="w-2.5 h-2.5" /> Ön Koşul
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-dark-subtext truncate mt-0.5" title={course.name}>
                      {course.name}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-medium text-slate-400 dark:text-dark-subtext">
                      {course.credit} Kredi / {course.ects} AKTS
                    </span>
                  </div>
                </div>

                {/* Instructors & Section count */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-dark-subtext pt-1 border-t border-slate-100 dark:border-dark-border/60">
                  <span className="truncate max-w-[150px]">
                    {course.instructors.length > 0 ? course.instructors.join(', ') : `${course.sections_count} Şube`}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCourseDetailModalCode(course.code)}
                      className="p-1 text-slate-400 hover:text-cankaya-blue dark:hover:text-cankaya-gold rounded transition"
                      title="Ders Detayı ve Web Sayfası"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleAddCourse(course.code)}
                      disabled={inBasket}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-[10px] transition ${
                        inBasket
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 cursor-default'
                          : 'bg-cankaya-blue hover:bg-cankaya-navy text-cankaya-gold dark:bg-cankaya-gold dark:hover:bg-cankaya-goldLight dark:text-slate-900 active:scale-95'
                      }`}
                    >
                      {inBasket ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Sepette</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          <span>Ekle</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
