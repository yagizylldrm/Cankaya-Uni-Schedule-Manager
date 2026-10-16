import React, { useState, useEffect, useMemo } from 'react';
import { useSchedule } from '../context/useSchedule';
import { fetchDepartments, fetchCourses, fetchCourseDetail } from '../services/api';
import {
  Search,
  Plus,
  Minus,
  Info,
  Filter,
  GraduationCap,
  AlertCircle,
  BookOpen,
  UserCheck,
  Check,
  ChevronDown
} from 'lucide-react';

export default function CourseSearchPanel() {
  const {
    profile,
    updateProfile,
    basket,
    addToBasket,
    removeFromBasket,
    toggleSectionSelection,
    selectCourseInstructor,
    passedCodesString,
    setCourseDetailModalCode,
    notify
  } = useSchedule();

  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingCodes, setAddingCodes] = useState({});
  const [departmentsError, setDepartmentsError] = useState('');
  const [coursesError, setCoursesError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  // Search & Filter state
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedType, setSelectedType] = useState('TÜMÜ');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [includeOutsideCurriculum, setIncludeOutsideCurriculum] = useState(false);
  const [instructorFilters, setInstructorFilters] = useState({});

  const orderedCourses = useMemo(() => {
    const recentFirst = new Map(Object.keys(basket).reverse().map((code, index) => [code, index]));
    return [...courses].sort((a, b) =>
      (recentFirst.get(a.code) ?? Infinity) - (recentFirst.get(b.code) ?? Infinity));
  }, [courses, basket]);

  // Load departments once
  useEffect(() => {
    fetchDepartments()
      .then(data => { setDepartments(data); setDepartmentsError(''); })
      .catch(err => setDepartmentsError(err.message || 'Bölümler yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.'));
  }, [retryKey]);

  // Fetch courses on filter/profile change
  useEffect(() => {
    let active = true;
    setLoading(true);
    setCoursesError('');

    const timer = setTimeout(() => {
      fetchCourses({
        query: searchQuery,
        dept: selectedDept,
        type: selectedType,
        primary_dept: profile.primaryDept,
        secondary_dept: profile.secondaryDept,
        secondary_type: profile.secondaryType,
        only_eligible: onlyEligible,
        hide_passed: profile.hidePassedCourses === true,
        include_outside_curriculum: includeOutsideCurriculum,
        passed_codes: passedCodesString
      })
        .then(data => {
          if (active) {
            setCourses(data);
            setCoursesError('');
            setLoading(false);
          }
        })
        .catch(err => {
          if (active) {
            setCoursesError(err.message || 'Dersler yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.');
            setLoading(false);
          }
        });
    }, 350);

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
    profile.hidePassedCourses,
    includeOutsideCurriculum,
    passedCodesString,
    retryKey
  ]);

  // Handle adding course to basket
  const handleAddCourse = async (courseCode, instructor) => {
    if (addingCodes[courseCode]) return;
    setAddingCodes(prev => ({ ...prev, [courseCode]: true }));
    try {
      const detail = await fetchCourseDetail(courseCode, {
        primary_dept: profile.primaryDept,
        secondary_dept: profile.secondaryDept,
        secondary_type: profile.secondaryType,
        passed_codes: passedCodesString
      });
      addToBasket(detail, instructor);
    } catch (err) {
      notify(`Ders eklenirken hata: ${err.message}`);
    } finally {
      setAddingCodes(prev => {
        const next = { ...prev };
        delete next[courseCode];
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface rounded-2xl border border-border-subtle shadow-sm overflow-hidden transition-colors">
      {/* Error Banner */}
      {(departmentsError || coursesError) && (
        <div role="alert" className="m-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 p-3 text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{departmentsError || coursesError}</p>
              <button
                type="button"
                className="underline mt-1 font-semibold hover:text-rose-900 dark:hover:text-rose-200"
                onClick={() => setRetryKey(value => value + 1)}
              >
                Tekrar dene
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Student Academic Profile (Bölüm & İkinci Dal) */}
      <div className="p-3.5 bg-surface-muted/40 border-b border-border-subtle space-y-2.5">
        <div className="flex items-center justify-between text-xs font-semibold text-ink">
          <span className="flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-brand" />
            <span>Öğrenci Müfredat Kaydı</span>
          </span>
          {departments.find(d => d.code === profile.primaryDept)?.curriculum_name && (
            <span className="text-[10px] font-normal text-ink-muted truncate max-w-[200px]">
              Müfredat: {departments.find(d => d.code === profile.primaryDept).curriculum_name}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {/* Primary Department */}
          <div>
            <label htmlFor="primary-department" className="block text-[11px] font-medium text-ink-muted mb-1">
              Ana Bölüm:
            </label>
            <select
              id="primary-department"
              aria-label="Ana bölüm"
              value={profile.primaryDept}
              onChange={(e) => updateProfile({ primaryDept: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-surface border border-border-subtle rounded-lg text-ink focus:border-brand focus:ring-1 focus:ring-brand font-medium text-xs transition-colors"
            >
              {departments.filter(d => d.has_curriculum || d.code === profile.primaryDept).map(d => (
                <option key={d.code} value={d.code}>{d.code} - {d.name}</option>
              ))}
            </select>
          </div>

          {/* Secondary Program Type */}
          <div>
            <label htmlFor="secondary-program-type" className="block text-[11px] font-medium text-ink-muted mb-1">
              İkinci Program:
            </label>
            <select
              id="secondary-program-type"
              aria-label="İkinci program türü"
              value={profile.secondaryType}
              onChange={(e) => updateProfile({ secondaryType: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-surface border border-border-subtle rounded-lg text-ink focus:border-brand focus:ring-1 focus:ring-brand font-medium text-xs transition-colors"
            >
              <option value="YOK">YOK (Tek Ana Dal)</option>
              <option value="CAP">Çift Anadal (ÇAP)</option>
              <option value="YANDAL">Yandal (Minor)</option>
            </select>
          </div>

          {/* Secondary Department if applicable */}
          {profile.secondaryType !== 'YOK' && (
            <div className="sm:col-span-2">
              <label htmlFor="secondary-department" className="block text-[11px] font-medium text-ink-muted mb-1">
                İkinci Program Bölümü:
              </label>
              <select
                id="secondary-department"
                aria-label="İkinci program bölümü"
                value={profile.secondaryDept}
                onChange={(e) => updateProfile({ secondaryDept: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-surface border border-border-subtle rounded-lg text-ink focus:border-brand focus:ring-1 focus:ring-brand font-medium text-xs transition-colors"
              >
                <option value="YOK">Bölüm Seçin...</option>
                {departments.filter(d => d.code !== profile.primaryDept && (d.has_curriculum || d.code === profile.secondaryDept)).map(d => (
                  <option key={d.code} value={d.code}>{d.code} - {d.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 2. Search & Filters */}
      <div className="p-3.5 border-b border-border-subtle space-y-2.5 bg-surface">
        <div className="flex items-center justify-between text-xs font-semibold text-ink">
          <span className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-brand" />
            <span>Katalog Filtreleri</span>
          </span>
          <span className="text-[11px] font-normal text-ink-muted tabular-nums">
            {courses.length} ders
          </span>
        </div>

        {/* Dept & Type Selectors */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <select
              aria-label="Ders bölümü filtresi"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-surface-muted/60 border border-border-subtle rounded-lg text-ink text-xs focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
            >
              <option value="">Tüm Bölümler</option>
              {departments.map(d => (
                <option key={d.code} value={d.code}>{d.code}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              aria-label="Ders türü filtresi"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-surface-muted/60 border border-border-subtle rounded-lg text-ink text-xs focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
            >
              <option value="TÜMÜ">Tüm Türler</option>
              <option value="ZORUNLU">Zorunlular</option>
              {profile.secondaryType === 'CAP' && <option value="ZORUNLU_CAP">ÇAP Zorunlu</option>}
              {profile.secondaryType === 'YANDAL' && <option value="ZORUNLU_YANDAL">Yandal Zorunlu</option>}
              <option value="SECMELI">Tüm Seçmeliler</option>
              <option value="TEKNIK_SECMELI">Teknik Seçmeli</option>
              <option value="SERBEST_SECMELI">Sosyal / Serbest</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-ink-muted absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            id="course-search-input"
            type="text"
            placeholder="Ders kodu veya öğretim elemanı ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 sm:py-1.5 text-sm sm:text-xs bg-surface-muted/60 border border-border-subtle rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
          />
        </div>

        {/* Checkbox filters */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5 text-[11px] text-ink-muted">
          <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-ink">
            <input
              type="checkbox"
              checked={onlyEligible}
              onChange={(e) => setOnlyEligible(e.target.checked)}
              className="rounded border-border-subtle text-ink focus:ring-brand w-3.5 h-3.5"
            />
            <span>Sadece alabileceğim</span>
          </label>

          {passedCodesString && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-ink">
              <input
                type="checkbox"
                checked={profile.hidePassedCourses === true}
                onChange={(e) => updateProfile({ hidePassedCourses: e.target.checked })}
                className="rounded border-border-subtle text-ink focus:ring-brand w-3.5 h-3.5"
              />
              <span>Geçtiğim Dersleri Gizle</span>
            </label>
          )}

          <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-ink">
            <input
              type="checkbox"
              checked={includeOutsideCurriculum}
              onChange={(e) => setIncludeOutsideCurriculum(e.target.checked)}
              className="rounded border-border-subtle text-ink focus:ring-brand w-3.5 h-3.5"
            />
            <span>Müfredat dışı açılan dersler</span>
          </label>
        </div>
      </div>

      {/* 3. Course Results List (Akademik Kayıt Defteri) */}
      <div className="flex-1 overflow-y-auto divide-y divide-border-subtle">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse space-y-2 p-3 rounded-lg bg-surface-muted/30">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-surface-muted rounded w-24" />
                  <div className="h-3 bg-surface-muted rounded w-20" />
                </div>
                <div className="h-3 bg-surface-muted rounded w-48" />
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted flex flex-col items-center gap-2 p-4">
            <BookOpen className="w-8 h-8 text-ink-muted/50 stroke-[1.5]" />
            <p className="font-medium text-ink">Kriterlere uygun ders bulunamadı.</p>
            <p className="text-[11px] text-ink-muted">Arama filtresini temizleyin veya başka bir bölüm seçin.</p>
          </div>
        ) : (
          orderedCourses.map(course => {
            const inBasket = !!basket[course.code];
            const isPassed = course.is_passed;
            const instructors = inBasket
              ? [...new Set((basket[course.code].allSections || []).map(s => s.instructor).filter(name => name && name !== 'Belirsiz'))].sort()
              : course.instructors || [];
            const selectedNumbers = inBasket ? basket[course.code].selectedSections || [] : [];
            const basketSections = inBasket ? basket[course.code].allSections || [] : [];
            const allSelected = inBasket && selectedNumbers.length === basketSections.length &&
              basketSections.every(s => selectedNumbers.includes(String(s.section_no)));
            const selectedInstructor = inBasket
              ? allSelected ? '' : instructors.find(name => {
                const matching = basketSections.filter(s => s.instructor === name).map(s => String(s.section_no));
                return matching.length === selectedNumbers.length &&
                  matching.every(number => selectedNumbers.includes(number));
              }) || '__custom__'
              : instructors.includes(instructorFilters[course.code]) ? instructorFilters[course.code] : '';

            // Status Badge styling
            let badgeClass = 'bg-surface-muted text-ink border border-border-subtle';
            if (course.type === 'ZORUNLU') {
              badgeClass = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60';
            } else if (course.type === 'ZORUNLU_CAP') {
              badgeClass = 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60';
            } else if (course.type === 'ZORUNLU_YANDAL') {
              badgeClass = 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-900/60';
            } else if (course.type === 'SERBEST_SECMELI' || course.type === 'TEKNIK_SECMELI') {
              badgeClass = 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60';
            }

            return (
              <article
                key={course.code}
                data-course-code={course.code}
                className={`group p-3 transition-colors ${
                  inBasket
                    ? 'bg-brand/5 border-l-4 border-l-brand pl-2.5'
                    : 'bg-surface hover:bg-surface-muted/40'
                } flex flex-col justify-between gap-1.5`}
              >
                {/* Header: Code, Badges, Credits */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-xs text-ink tracking-tight">
                        {course.code}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeClass}`}>
                        {course.type_label}
                      </span>
                      {inBasket && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand text-stone-900 flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                          <span>Seçildi</span>
                        </span>
                      )}
                      {isPassed && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center gap-0.5">
                          <UserCheck className="w-2.5 h-2.5" />
                          <span>Geçildi</span>
                        </span>
                      )}
                      {course.can_take === null && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300" title={course.prereq_message}>
                          Ön koşul bilgisi eksik
                        </span>
                      )}
                      {course.can_take === false && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 flex items-center gap-0.5" title={course.prereq_message}>
                          <AlertCircle className="w-2.5 h-2.5" />
                          <span>Ön Koşul</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-ink font-medium truncate mt-0.5" title={course.name}>
                      {course.name}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-medium text-ink-muted tabular-nums">
                      {course.credit} Kredi / {course.ects} AKTS
                    </span>
                  </div>
                </div>

                {/* Footer: Instructors & Add/Remove Action */}
                <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1 border-t border-border-subtle/50">
                  <span className="truncate max-w-[170px]">
                    {course.untimed ? 'Haftalık ders saati yok' : instructors.length > 0 ? instructors.join(', ') : `${course.sections_count} Şube`}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCourseDetailModalCode(course.code)}
                      className="p-1 text-ink-muted hover:text-ink rounded transition-colors"
                      title="Ders Detayı ve Web Sayfası"
                      aria-label={`${course.code} ders detayı`}
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => inBasket ? removeFromBasket(course.code) : handleAddCourse(course.code, selectedInstructor)}
                      disabled={Boolean(addingCodes[course.code])}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-xs transition-colors ${
                        inBasket
                          ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
                          : 'primary-action'
                      }`}
                    >
                      {addingCodes[course.code] ? (
                        <span>Ekleniyor…</span>
                      ) : inBasket ? (
                        <>
                          <Minus className="w-3 h-3 stroke-[2.5]" />
                          <span>Çıkar</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3 stroke-[2.5]" />
                          <span>Ekle</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Optional: Instructor Filter Dropdown */}
                {instructors.length > 1 && (
                  <label className="flex items-center gap-2 text-[11px] text-ink-muted pt-0.5">
                    <span className="shrink-0 font-medium">Hoca:</span>
                    <select
                      aria-label={`${course.code} hoca filtresi`}
                      value={selectedInstructor}
                      onChange={e => {
                        if (inBasket) selectCourseInstructor(course.code, e.target.value);
                        else setInstructorFilters(prev => ({ ...prev, [course.code]: e.target.value }));
                      }}
                      className="min-w-0 flex-1 px-2 py-1 rounded-lg bg-surface-muted/60 border border-border-subtle text-ink text-xs focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
                    >
                      <option value="">Tüm hocalar</option>
                      {selectedInstructor === '__custom__' && <option value="__custom__" disabled>Özel şube seçimi</option>}
                      {instructors.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </label>
                )}

                {/* Optional: Sections Details Accordion */}
                {inBasket && basketSections.length > 1 && (
                  <details className="border-t border-border-subtle/50 pt-1 text-[11px] text-ink-muted">
                    <summary className="cursor-pointer font-medium select-none py-1 hover:text-ink flex items-center justify-between">
                      <span>Şubeler ({selectedNumbers.length}/{basketSections.length})</span>
                      <ChevronDown className="w-3 h-3 text-ink-muted" />
                    </summary>
                    <div className="space-y-1 pt-1">
                      {basketSections.map(section => (
                        <label key={section.section_no} className="flex items-start gap-2 rounded-lg px-2 py-1 hover:bg-surface-muted/60 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedNumbers.includes(String(section.section_no))}
                            onChange={() => toggleSectionSelection(course.code, section.section_no)}
                            className="mt-0.5 rounded border-border-subtle text-ink focus:ring-brand w-3.5 h-3.5"
                          />
                          <span className="text-xs">
                            <strong className="text-ink">Şube {section.section_no}</strong>
                            {section.instructor && <span className="text-ink-muted"> · {section.instructor}</span>}
                            <span className="block text-[10px] text-ink-muted font-mono">
                              {(section.slots || []).map(slot => `${slot.day} ${slot.time_slot}`).join(', ') || 'Saat bilgisi yok'}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </details>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
