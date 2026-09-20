import React, { useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { 
  ShoppingBag, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Award, 
  BookMarked,
  Edit2,
  Check,
  X
} from 'lucide-react';

export default function CourseBasket() {
  const {
    basket,
    removeFromBasket,
    toggleSectionSelection,
    updateCourseCredit
  } = useSchedule();

  const [expandedCourses, setExpandedCourses] = useState({});
  const [editingCreditCode, setEditingCreditCode] = useState(null);
  const [editCreditVal, setEditCreditVal] = useState(3);
  const [editEctsVal, setEditEctsVal] = useState(5);

  const courseList = Object.values(basket);

  // Toggle accordion for section details
  const toggleExpand = (code) => {
    setExpandedCourses(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  // Start credit edit
  const startEditCredit = (course) => {
    setEditingCreditCode(course.code);
    setEditCreditVal(course.credit);
    setEditEctsVal(course.ects);
  };

  // Save credit edit
  const saveEditCredit = (code) => {
    updateCourseCredit(code, editCreditVal, editEctsVal);
    setEditingCreditCode(null);
  };

  // Summary calculations
  const totalCourses = courseList.length;
  const totalCredit = courseList.reduce((acc, c) => acc + (c.credit || 0), 0);
  const totalEcts = courseList.reduce((acc, c) => acc + (c.ects || 0), 0);

  // Calculate approximate weekly hours
  const totalWeeklyHours = courseList.reduce((acc, c) => {
    // If sections selected, take the average slot count of selected sections
    const selectedSecs = (c.allSections || []).filter(s => c.selectedSections.includes(String(s.section_no)));
    if (selectedSecs.length > 0) {
      const maxSlots = Math.max(...selectedSecs.map(s => (s.slots || []).length));
      return acc + maxSlots;
    }
    return acc + (c.credit || 3);
  }, 0);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-surface rounded-2xl border border-slate-200 dark:border-dark-border shadow-sm overflow-hidden">
      
      {/* Header */}
      <div className="p-3.5 bg-slate-50/80 dark:bg-dark-card/50 border-b border-slate-200 dark:border-dark-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-cankaya-blue dark:text-cankaya-gold" />
          <h2 className="text-xs font-bold text-slate-800 dark:text-dark-text uppercase tracking-wider">
            Alınmak İstenen Dersler ({totalCourses})
          </h2>
        </div>
      </div>

      {/* Course Basket Items */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {courseList.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 dark:text-dark-subtext flex flex-col items-center gap-2">
            <BookMarked className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            <p>Sepetiniz şu anda boş.</p>
            <p className="text-[11px] text-slate-400">Soldaki listeden almak istediğiniz dersleri ekleyin.</p>
          </div>
        ) : (
          courseList.map(course => {
            const isExpanded = !!expandedCourses[course.code];
            const isEditing = editingCreditCode === course.code;
            const sections = course.allSections || [];
            const selectedSecNos = course.selectedSections || [];

            return (
              <div
                key={course.code}
                className="rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card overflow-hidden shadow-xs"
              >
                {/* Main Card Header */}
                <div className="p-2.5 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-dark-card/80">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 dark:text-dark-text">
                        {course.code}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-dark-subtext font-semibold">
                        {selectedSecNos.length}/{sections.length} Şube
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-dark-subtext truncate max-w-[180px]">
                      {course.name}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Credit Edit trigger */}
                    {!isEditing ? (
                      <button
                        onClick={() => startEditCredit(course)}
                        className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition flex items-center gap-1"
                        title="Krediyi düzenle"
                      >
                        <span>{course.credit} Kr / {course.ects} AKTS</span>
                        <Edit2 className="w-2.5 h-2.5 text-slate-400" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 bg-white dark:bg-dark-surface p-1 rounded-lg border border-slate-300 dark:border-dark-border">
                        <input
                          type="number"
                          value={editCreditVal}
                          onChange={(e) => setEditCreditVal(e.target.value)}
                          className="w-8 px-1 py-0.5 text-xs text-center border rounded dark:bg-dark-card dark:text-white"
                          title="Yerel Kredi"
                        />
                        <span className="text-xs text-slate-400">/</span>
                        <input
                          type="number"
                          value={editEctsVal}
                          onChange={(e) => setEditEctsVal(e.target.value)}
                          className="w-8 px-1 py-0.5 text-xs text-center border rounded dark:bg-dark-card dark:text-white"
                          title="AKTS"
                        />
                        <button
                          onClick={() => saveEditCredit(course.code)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingCreditCode(null)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Expand sections toggle */}
                    <button
                      onClick={() => toggleExpand(course.code)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                      title={isExpanded ? 'Şubeleri Gizle' : 'Şubeleri Göster'}
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {/* Delete course button */}
                    <button
                      onClick={() => removeFromBasket(course.code)}
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition"
                      title="Sepetten Kaldır"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Section Checkboxes Accordion */}
                {isExpanded && (
                  <div className="p-2 border-t border-slate-100 dark:border-dark-border/60 bg-slate-50/40 dark:bg-dark-surface/40 space-y-1.5 text-xs">
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-dark-subtext mb-1">
                      Dahil Edilecek Şubeler:
                    </div>
                    {sections.map(sec => {
                      const isChecked = selectedSecNos.includes(String(sec.section_no));
                      const slotsDesc = (sec.slots || []).map(s => `${s.day.slice(0, 3)} ${s.time_slot}`).join(', ');

                      return (
                        <label
                          key={sec.section_no}
                          className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-dark-card border border-transparent hover:border-slate-200 dark:hover:border-dark-border cursor-pointer select-none transition"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSectionSelection(course.code, sec.section_no)}
                            className="mt-0.5 rounded border-slate-300 dark:border-dark-border text-cankaya-blue focus:ring-cankaya-blue w-3.5 h-3.5"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 dark:text-dark-text">
                                Section {sec.section_no}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-dark-subtext truncate">
                                • {sec.instructor}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-dark-subtext truncate">
                              {slotsDesc || 'Saat bilgisi girilmemiş'}
                              {sec.classroom ? ` (${sec.classroom})` : ''}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary Stats Card */}
      <div className="p-3 bg-slate-50 dark:bg-dark-card border-t border-slate-200 dark:border-dark-border">
        <div className="grid grid-cols-4 gap-1 text-center">
          <div className="p-1.5 rounded-lg bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border">
            <div className="text-[10px] text-slate-400 dark:text-dark-subtext">Ders</div>
            <div className="text-sm font-bold text-slate-800 dark:text-dark-text">{totalCourses}</div>
          </div>
          <div className="p-1.5 rounded-lg bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border">
            <div className="text-[10px] text-blue-500 font-medium">Kredi</div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{totalCredit}</div>
          </div>
          <div className="p-1.5 rounded-lg bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border">
            <div className="text-[10px] text-purple-500 font-medium">AKTS</div>
            <div className="text-sm font-bold text-purple-600 dark:text-purple-400">{totalEcts}</div>
          </div>
          <div className="p-1.5 rounded-lg bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border">
            <div className="text-[10px] text-emerald-500 font-medium">Saat/Hafta</div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{totalWeeklyHours}</div>
          </div>
        </div>
      </div>

    </div>
  );
}
