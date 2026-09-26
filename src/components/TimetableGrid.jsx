import React, { useMemo, useState } from 'react';
import { parseTimeRange } from '../utils/plan';
import { choosePreviewSections } from '../utils/previewSections';
import { useSchedule } from '../context/useSchedule';
import { MapPin, User, Clock, Plus, AlertTriangle } from 'lucide-react';

const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

const BASE_TIME_SLOTS = [
  "09:00 - 09:50",
  "10:00 - 10:50",
  "11:00 - 11:50",
  "12:00 - 12:50",
  "13:00 - 13:50",
  "14:00 - 14:50",
  "15:00 - 15:50",
  "16:00 - 16:50",
  "17:00 - 17:50",
  "18:00 - 18:50",
  "19:00 - 19:50",
  "20:00 - 20:50"
];

// Aesthetic color palettes for courses
const COURSE_PALETTES = [
  { bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-950 dark:text-blue-200', tag: 'bg-blue-200/60 dark:bg-blue-800/60 text-blue-900 dark:text-blue-100', swatch: 'bg-blue-500' },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-950 dark:text-emerald-200', tag: 'bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-900 dark:text-emerald-100', swatch: 'bg-emerald-500' },
  { bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-300 dark:border-violet-700', text: 'text-violet-950 dark:text-violet-200', tag: 'bg-violet-200/60 dark:bg-violet-800/60 text-violet-900 dark:text-violet-100', swatch: 'bg-violet-500' },
  { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-950 dark:text-amber-200', tag: 'bg-amber-200/60 dark:bg-amber-800/60 text-amber-900 dark:text-amber-100', swatch: 'bg-amber-500' },
  { bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-300 dark:border-rose-700', text: 'text-rose-950 dark:text-rose-200', tag: 'bg-rose-200/60 dark:bg-rose-800/60 text-rose-900 dark:text-rose-100', swatch: 'bg-rose-500' },
  { bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-300 dark:border-cyan-700', text: 'text-cyan-950 dark:text-cyan-200', tag: 'bg-cyan-200/60 dark:bg-cyan-800/60 text-cyan-900 dark:text-cyan-100', swatch: 'bg-cyan-500' },
  { bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40', border: 'border-fuchsia-300 dark:border-fuchsia-700', text: 'text-fuchsia-950 dark:text-fuchsia-200', tag: 'bg-fuchsia-200/60 dark:bg-fuchsia-800/60 text-fuchsia-900 dark:text-fuchsia-100', swatch: 'bg-fuchsia-500' },
  { bg: 'bg-indigo-50 dark:bg-indigo-950/40', border: 'border-indigo-300 dark:border-indigo-700', text: 'text-indigo-950 dark:text-indigo-200', tag: 'bg-indigo-200/60 dark:bg-indigo-800/60 text-indigo-900 dark:text-indigo-100', swatch: 'bg-indigo-500' },
];

const CUSTOM_BLOCK_COLORS = {
  amber: { bg: 'bg-amber-100 dark:bg-amber-950/50', border: 'border-amber-400 dark:border-amber-700', text: 'text-amber-900 dark:text-amber-200' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-950/50', border: 'border-emerald-400 dark:border-emerald-700', text: 'text-emerald-900 dark:text-emerald-200' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-950/50', border: 'border-blue-400 dark:border-blue-700', text: 'text-blue-900 dark:text-blue-200' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-950/50', border: 'border-purple-400 dark:border-purple-700', text: 'text-purple-900 dark:text-purple-200' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-950/50', border: 'border-rose-400 dark:border-rose-700', text: 'text-rose-900 dark:text-rose-200' },
  slate: { bg: 'bg-slate-100 dark:bg-slate-800/60', border: 'border-slate-300 dark:border-slate-600', text: 'text-slate-800 dark:text-slate-200' }
};

export default function TimetableGrid({ gridRef }) {
  const {
    sortedCombinations,
    selectedCombination,
    basket,
    customBlocks,
    setCustomBlockModalData,
    setCourseDetailModalCode,
    courseColors,
    updateCourseColor,
    isGenerating
  } = useSchedule();
  const [view, setView] = useState(() => window.matchMedia('(max-width: 767px)').matches ? 'agenda' : 'week');
  const [agendaDay, setAgendaDay] = useState(() => DAYS[(new Date().getDay() + 6) % 7]);

  // Active sections to display:
  // If combinations are available, use the currently active combination.
  // Otherwise, if basket has items, show draft preview of selected sections.
  const activeSections = useMemo(() => {
    if (selectedCombination) {
      const previous = selectedCombination.sections || [];
      if (!isGenerating) return previous;

      // Keep the existing timetable in place while updating, but apply section
      // removals and replacements immediately. Newly added courses appear when
      // the server returns a conflict-free combination.
      const active = previous.filter(sec =>
        basket[sec.course_code]?.selectedSections?.includes(String(sec.section_no)));
      const activeCodes = new Set(active.map(sec => sec.course_code));
      for (const code of new Set(previous.map(sec => sec.course_code))) {
        const course = basket[code];
        if (!course || activeCodes.has(code)) continue;
        const replacement = (course.allSections || []).find(sec =>
          course.selectedSections?.includes(String(sec.section_no)));
        if (replacement) active.push({ ...replacement, course_code: code });
      }
      return active;
    }

    return choosePreviewSections(basket, customBlocks);
  }, [selectedCombination, basket, customBlocks, isGenerating]);

  // Check if there are any weekend classes or custom blocks
  const hasWeekendContent = useMemo(() => {
    const weekendDays = ['Cumartesi', 'Pazar'];
    const sectionsOnWeekend = activeSections.some(section =>
      (section.slots || []).some(slot => weekendDays.includes(slot.day))
    );
    const blocksOnWeekend = Object.values(customBlocks || {}).some(block =>
      weekendDays.includes(block.day)
    );
    return sectionsOnWeekend || blocksOnWeekend;
  }, [activeSections, customBlocks]);

  // Empty weekend columns are never useful in the timetable preview.
  const visibleDays = hasWeekendContent ? DAYS : DAYS.slice(0, 5);

  const TIME_SLOTS = useMemo(() => {
    const contentStartTimes = [];
    for (const section of activeSections) for (const slot of section.slots || []) {
      const start = parseTimeRange(slot.time_slot)?.[0];
      if (Number.isFinite(start)) contentStartTimes.push(start);
    }
    for (const block of Object.values(customBlocks || {})) {
      const start = parseTimeRange(block.time_slot)?.[0];
      if (Number.isFinite(start)) contentStartTimes.push(start);
    }

    const latestContentStart = contentStartTimes.length ? Math.max(...contentStartTimes) : 960;
    const latestVisibleStart = Math.max(960, latestContentStart);
    const startTimes = new Set(
      BASE_TIME_SLOTS
        .map(slot => parseTimeRange(slot)?.[0])
        .filter(start => Number.isFinite(start) && start <= latestVisibleStart)
    );
    contentStartTimes.forEach(start => startTimes.add(start));

    return [...startTimes].sort((a, b) => a - b).map(start => {
      const label = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      return `${label(start)} - ${label(start + 50)}`;
    });
  }, [activeSections, customBlocks]);

  // Color mapping per course code
  const getCourseColorPalette = useMemo(() => {
    const map = {};
    const codes = Array.from(new Set(activeSections.map(s => s.course_code)));
    codes.forEach((code, idx) => {
      const paletteIndex = courseColors[code] !== undefined ? courseColors[code] : idx;
      map[code] = COURSE_PALETTES[paletteIndex % COURSE_PALETTES.length];
    });
    return map;
  }, [activeSections, courseColors]);

  // Matches a slot to a time slot label
  const matchSlotToRow = (slotTime, rowTime) => {
    const slot = parseTimeRange(slotTime);
    const row = parseTimeRange(rowTime);
    return Boolean(slot && row && slot[0] === row[0]);
  };
  const overlapsAt = (day, rowTime) => {
    const currentStart = parseTimeRange(rowTime)?.[0];
    if (currentStart === undefined) return false;
    const entries = [
      ...activeSections.flatMap(section => (section.slots || []).filter(slot => slot.day === day).map(slot => parseTimeRange(slot.time_slot))),
      ...Object.values(customBlocks || {}).filter(block => block.day === day).map(block => parseTimeRange(block.time_slot))
    ].filter(Boolean);
    const atRow = entries.filter(range => range[0] === currentStart);
    if (!atRow.length) return false;
    return atRow.some(range => entries.some(other =>
      other !== range && Math.max(range[0], other[0]) < Math.min(range[1], other[1])));
  };

  // Build 2D grid matrix: grid[day][timeSlot] = { courses: [...], customBlock: ... }
  const gridMatrix = useMemo(() => {
    const matrix = {};
    DAYS.forEach(day => {
      matrix[day] = {};
      TIME_SLOTS.forEach(time => {
        matrix[day][time] = { courses: [], customBlock: null };
      });
    });

    // Populate active courses
    activeSections.forEach(sec => {
      (sec.slots || []).forEach(slot => {
        const day = slot.day;
        if (!matrix[day]) return;

        TIME_SLOTS.forEach(time => {
          if (matchSlotToRow(slot.time_slot, time)) {
            matrix[day][time].courses.push({
              course_code: sec.course_code,
              section_no: sec.section_no,
              instructor: sec.instructor,
              classroom: slot.classroom || sec.classroom,
              raw_slot: slot.time_slot
            });
          }
        });
      });
    });

    // Populate custom blocks
    Object.values(customBlocks || {}).forEach(b => {
      const day = b.day;
      if (!matrix[day]) return;

      TIME_SLOTS.forEach(time => {
        if (matchSlotToRow(b.time_slot, time)) {
          matrix[day][time].customBlock = b;
        }
      });
    });

    return matrix;
  }, [activeSections, customBlocks, TIME_SLOTS]);

  const agendaItems = [
    ...activeSections.flatMap(sec => (sec.slots || []).filter(s => s.day === agendaDay).map(s => ({ ...s,
      title: `${sec.course_code} · Şube ${sec.section_no}`, detail: [s.classroom || sec.classroom, sec.instructor].filter(Boolean).join(' · '),
      courseCode: sec.course_code, block: null }))),
    ...Object.values(customBlocks).filter(b => b.day === agendaDay).map(b => ({ ...b, detail: b.note, block: b }))
  ].sort((a, b) => (parseTimeRange(a.time_slot)?.[0] ?? 0) - (parseTimeRange(b.time_slot)?.[0] ?? 0));

  return (
    <>
    <div data-view-controls className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p role="status">{isGenerating ? 'Program güncelleniyor…' : sortedCombinations.length ? 'Seçili program' : 'Taslak · Her ders için bir şubenin ön izlemesi'}</p>
      <div className="flex gap-1 rounded-xl bg-white dark:bg-dark-surface p-1 border border-slate-200 dark:border-dark-border">
        <button aria-pressed={view === 'agenda'} onClick={() => setView('agenda')} className={`px-3 py-2 rounded-lg ${view === 'agenda' ? 'bg-cankaya-blue text-white' : ''}`}>Günlük</button>
        <button aria-pressed={view === 'week'} onClick={() => setView('week')} className={`px-3 py-2 rounded-lg ${view === 'week' ? 'bg-cankaya-blue text-white' : ''}`}>Haftalık</button>
      </div>
    </div>
    {view === 'agenda' && <section data-agenda aria-label="Günlük program" className="bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-3 text-sm font-semibold"><label htmlFor="agenda-day">Gün</label>
        <select id="agenda-day" value={agendaDay} onChange={e => setAgendaDay(e.target.value)} className="rounded-lg border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card px-3 py-2 flex-1">
          {DAYS.map(day => <option key={day}>{day}</option>)}
        </select>
      </div>
      {!agendaItems.length && <p className="text-sm text-slate-500 dark:text-dark-subtext py-6">{agendaDay} için ders veya etkinlik bulunmuyor.</p>}
      <ul className="space-y-3">
        {agendaItems.map((item, index) => {
          const range = parseTimeRange(item.time_slot);
          const conflict = range && agendaItems.some((other, i) => {
            const r = parseTimeRange(other.time_slot);
            return i !== index && r && Math.max(range[0], r[0]) < Math.min(range[1], r[1]);
          });
          return <li key={`${item.title}-${item.time_slot}-${index}`}>
            <button onClick={() => item.block ? setCustomBlockModalData({ day: agendaDay, timeSlot: item.time_slot, currentBlock: item.block }) : setCourseDetailModalCode(item.courseCode)}
              className={`w-full text-left rounded-xl border p-4 space-y-1 ${conflict ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/20' : 'border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-card'}`}>
              <p className="text-sm font-semibold">{item.time_slot.replace('/', ' – ')}</p>
              <p className="font-bold">{item.title}</p>
              {item.detail && <p className="text-sm text-slate-600 dark:text-dark-subtext">{item.detail}</p>}
              {conflict && <p className="text-sm text-rose-700 dark:text-rose-300 font-semibold">Bu saatte çakışma var</p>}
            </button>
          </li>;
        })}
      </ul>
      <button onClick={() => setCustomBlockModalData({ day: agendaDay, timeSlot: '12:00 - 12:50', currentBlock: null })} className="primary-action">Etkinlik ekle</button>
    </section>}
    <div
      ref={gridRef}
      data-weekly-grid
      className={`${view === 'week' ? 'flex' : 'hidden'} bg-white dark:bg-dark-surface rounded-2xl border border-slate-200 dark:border-dark-border shadow-xs overflow-hidden flex-col min-h-[600px]`}
    >
      <div data-grid-scroll className="overflow-x-auto overscroll-x-contain touch-pan-x">
        <table className="w-full table-fixed border-collapse min-w-[700px] text-left">
          
          {/* Header Days Row */}
          <thead>
            <tr className="bg-slate-50 dark:bg-dark-card border-b border-slate-200 dark:border-dark-border">
              <th className="w-24 p-2.5 text-center text-[11px] font-bold text-slate-500 dark:text-dark-subtext uppercase tracking-wider border-r border-slate-200 dark:border-dark-border">
                Saat
              </th>
              {visibleDays.map(day => (
                <th
                  key={day} 
                  className="p-2.5 text-center text-xs font-bold text-cankaya-blue dark:text-cankaya-gold tracking-wide border-r border-slate-200 dark:border-dark-border last:border-r-0"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>

          {/* Time Slots Rows */}
          <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
            {TIME_SLOTS.map(timeSlot => (
              <tr key={timeSlot} className="hover:bg-slate-50/40 dark:hover:bg-dark-card/20 transition-colors">
                
                {/* Time Slot Label */}
                <td className="p-2 text-center text-[11px] font-semibold text-slate-500 dark:text-dark-subtext border-r border-slate-200 dark:border-dark-border bg-slate-50/50 dark:bg-dark-card/30 whitespace-nowrap">
                  {timeSlot}
                </td>

                {/* Day Columns for this time slot */}
                {visibleDays.map(day => {
                  const cell = gridMatrix[day]?.[timeSlot] || { courses: [], customBlock: null };
                  const courses = cell.courses;
                  const customBlock = cell.customBlock;
                  const hasConflict = overlapsAt(day, timeSlot);

                  return (
                    <td
                      key={day}
                      className="p-1 border-r border-slate-200 dark:border-dark-border last:border-r-0 h-16 align-top relative group"
                    >
                      {/* Empty cell: Hover plus button to add custom block */}
                      {courses.length === 0 && !customBlock ? (
                        <button
                          onClick={() => setCustomBlockModalData({ day, timeSlot, currentBlock: null })}
                          className="w-full h-full min-h-[58px] rounded-lg border border-transparent group-hover:border-dashed group-hover:border-slate-300 dark:group-hover:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600 group-hover:text-cankaya-blue dark:group-hover:text-cankaya-gold transition"
                          title="Özel etkinlik / mola ekle"
                        >
                          <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ) : (
                        <div className="space-y-1">
                          
                          {/* Conflict Banner if multiple courses or course + block in same slot */}
                          {hasConflict && (
                            <div className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-bold flex items-center gap-1 shadow-xs">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>ÇAKIŞMA!</span>
                            </div>
                          )}

                          {/* Custom Block */}
                          {customBlock && (
                            <div
                              onClick={() => setCustomBlockModalData({ day, timeSlot, currentBlock: customBlock })}
                              className={`p-1.5 rounded-lg border text-[11px] cursor-pointer shadow-xs transition hover:brightness-95 ${
                                (CUSTOM_BLOCK_COLORS[customBlock.color] || CUSTOM_BLOCK_COLORS.amber).bg
                              } ${
                                (CUSTOM_BLOCK_COLORS[customBlock.color] || CUSTOM_BLOCK_COLORS.amber).border
                              } ${
                                (CUSTOM_BLOCK_COLORS[customBlock.color] || CUSTOM_BLOCK_COLORS.amber).text
                              }`}
                              title="Düzenlemek veya silmek için tıklayın"
                            >
                              <div className="font-bold truncate">{customBlock.title}</div>
                              {customBlock.note && (
                                <div className="text-[9px] opacity-80 truncate">{customBlock.note}</div>
                              )}
                            </div>
                          )}

                          {/* Courses */}
                          {courses.map((c, i) => {
                            const palette = getCourseColorPalette[c.course_code] || COURSE_PALETTES[0];
                            const selectedPaletteIndex = COURSE_PALETTES.indexOf(palette);

                            return (
                              <div
                                key={`${c.course_code}-${c.section_no}-${i}`}
                                onClick={() => setCourseDetailModalCode(c.course_code)}
                                className={`group/course p-1.5 rounded-lg border text-xs cursor-pointer shadow-xs transition-all hover:scale-[1.02] ${palette.bg} ${palette.border} ${palette.text}`}
                                title={`${c.course_code} Sec ${c.section_no} - ${c.instructor}`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-extrabold tracking-tight">{c.course_code}</span>
                                  <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${palette.tag}`}>
                                    S.{c.section_no}
                                  </span>
                                </div>

                                <div className="text-[10px] opacity-90 truncate mt-0.5 flex items-center gap-1">
                                  {c.classroom && (
                                    <span className="font-semibold flex items-center gap-0.5">
                                      <MapPin className="w-2.5 h-2.5" /> {c.classroom}
                                    </span>
                                  )}
                                  {c.instructor && (
                                    <span className="truncate">
                                      • {c.instructor}
                                    </span>
                                  )}
                                </div>
                                <div className="invisible mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover/course:visible group-hover/course:opacity-100">
                                  {COURSE_PALETTES.map((option, paletteIndex) => (
                                    <button
                                      key={option.swatch}
                                      type="button"
                                      aria-label={`${c.course_code} rengini değiştir`}
                                      aria-pressed={paletteIndex === selectedPaletteIndex}
                                      onClick={event => {
                                        event.stopPropagation();
                                        updateCourseColor(c.course_code, paletteIndex);
                                      }}
                                      className={`w-3 h-3 rounded-full ${option.swatch} ${paletteIndex === selectedPaletteIndex ? 'ring-2 ring-offset-1 ring-slate-700 dark:ring-slate-200' : ''}`}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}

                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
