import React, { useMemo, useState } from 'react';
import { parseTimeRange } from '../utils/plan';
import { choosePreviewSections } from '../utils/previewSections';
import { useSchedule } from '../context/useSchedule';
import { MapPin, Plus, AlertTriangle } from 'lucide-react';

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

// Fixed 8-color palette with semantic left spines and tags
const COURSE_PALETTES = [
  {
    spine: 'border-l-blue-600 dark:border-l-blue-400',
    tag: 'bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200',
    swatch: 'bg-blue-600',
  },
  {
    spine: 'border-l-emerald-600 dark:border-l-emerald-400',
    tag: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200',
    swatch: 'bg-emerald-600',
  },
  {
    spine: 'border-l-violet-600 dark:border-l-violet-400',
    tag: 'bg-violet-100 dark:bg-violet-950/60 text-violet-900 dark:text-violet-200',
    swatch: 'bg-violet-600',
  },
  {
    spine: 'border-l-amber-600 dark:border-l-amber-400',
    tag: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200',
    swatch: 'bg-amber-600',
  },
  {
    spine: 'border-l-rose-600 dark:border-l-rose-400',
    tag: 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200',
    swatch: 'bg-rose-600',
  },
  {
    spine: 'border-l-cyan-600 dark:border-l-cyan-400',
    tag: 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-900 dark:text-cyan-200',
    swatch: 'bg-cyan-600',
  },
  {
    spine: 'border-l-fuchsia-600 dark:border-l-fuchsia-400',
    tag: 'bg-fuchsia-100 dark:bg-fuchsia-950/60 text-fuchsia-900 dark:text-fuchsia-200',
    swatch: 'bg-fuchsia-600',
  },
  {
    spine: 'border-l-indigo-600 dark:border-l-indigo-400',
    tag: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200',
    swatch: 'bg-indigo-600',
  },
];

const CUSTOM_BLOCK_COLORS = {
  amber: {
    spine: 'border-l-amber-500 dark:border-l-amber-400',
    tag: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200'
  },
  emerald: {
    spine: 'border-l-emerald-500 dark:border-l-emerald-400',
    tag: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200'
  },
  blue: {
    spine: 'border-l-blue-500 dark:border-l-blue-400',
    tag: 'bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200'
  },
  purple: {
    spine: 'border-l-purple-500 dark:border-l-purple-400',
    tag: 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200'
  },
  rose: {
    spine: 'border-l-rose-500 dark:border-l-rose-400',
    tag: 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200'
  },
  slate: {
    spine: 'border-l-stone-500 dark:border-l-stone-400',
    tag: 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-200'
  }
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

  // Build 2D grid matrix: grid[day][timeSlot] = { courses: [], customBlock: ... }
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
    ...activeSections.flatMap(sec => (sec.slots || []).filter(s => s.day === agendaDay).map(s => ({
      ...s,
      title: `${sec.course_code} · Şube ${sec.section_no}`,
      detail: [s.classroom || sec.classroom, sec.instructor].filter(Boolean).join(' · '),
      courseCode: sec.course_code,
      block: null
    }))),
    ...Object.values(customBlocks || {}).filter(b => b.day === agendaDay).map(b => ({
      ...b,
      detail: b.note,
      block: b
    }))
  ].sort((a, b) => (parseTimeRange(a.time_slot)?.[0] ?? 0) - (parseTimeRange(b.time_slot)?.[0] ?? 0));

  return (
    <>
      {/* Top View Controls: Title / Status and View Toggle */}
      <div data-view-controls className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm py-1">
        <p role="status" className="font-medium text-ink-muted">
          {isGenerating ? 'Program güncelleniyor…' : sortedCombinations.length ? 'Seçili program' : 'Taslak · Her ders için bir şubenin ön izlemesi'}
        </p>

        <div className="inline-flex rounded-xl bg-surface-muted/60 p-0.5 border border-border-subtle">
          <button
            type="button"
            aria-pressed={view === 'agenda'}
            onClick={() => setView('agenda')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              view === 'agenda' ? 'bg-surface text-ink shadow-sm border border-border-subtle' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Günlük
          </button>
          <button
            type="button"
            aria-pressed={view === 'week'}
            onClick={() => setView('week')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              view === 'week' ? 'bg-surface text-ink shadow-sm border border-border-subtle' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Haftalık
          </button>
        </div>
      </div>

      {/* Mobile Agenda View */}
      {view === 'agenda' && (
        <section
          data-agenda
          aria-label="Günlük program"
          className="bg-surface rounded-2xl border border-border-subtle p-4 space-y-4 transition-colors"
        >
          <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-ink">
            <label htmlFor="agenda-day" className="shrink-0 text-ink-muted font-medium">Gün</label>
            <select
              id="agenda-day"
              value={agendaDay}
              onChange={e => setAgendaDay(e.target.value)}
              className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs sm:text-sm text-ink font-medium flex-1 focus:border-brand focus:ring-1 focus:ring-brand"
            >
              {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
            </select>
          </div>

          {!agendaItems.length && (
            <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border-subtle bg-surface-muted/30 space-y-3">
              <p className="text-xs sm:text-sm text-ink-muted">
                {agendaDay} için ders veya etkinlik bulunmuyor.
              </p>
              <button
                type="button"
                onClick={() => setCustomBlockModalData({ day: agendaDay, timeSlot: '12:00 - 12:50', currentBlock: null })}
                className="rounded-xl px-4 py-2 bg-surface border border-border-subtle text-ink font-semibold text-xs hover:bg-surface-muted transition-colors shadow-sm"
              >
                Etkinlik ekle
              </button>
            </div>
          )}

          {agendaItems.length > 0 && (
            <ul className="space-y-2.5">
              {agendaItems.map((item, index) => {
                const range = parseTimeRange(item.time_slot);
                const conflict = range && agendaItems.some((other, i) => {
                  const r = parseTimeRange(other.time_slot);
                  return i !== index && r && Math.max(range[0], r[0]) < Math.min(range[1], r[1]);
                });
                const palette = item.courseCode ? (getCourseColorPalette[item.courseCode] || COURSE_PALETTES[0]) : null;
                const blockStyle = item.block ? (CUSTOM_BLOCK_COLORS[item.block.color] || CUSTOM_BLOCK_COLORS.amber) : null;
                const spineClass = palette ? palette.spine : (blockStyle?.spine || 'border-l-brand');

                return (
                  <li key={`${item.title}-${item.time_slot}-${index}`}>
                    <button
                      type="button"
                      onClick={() => item.block ? setCustomBlockModalData({ day: agendaDay, timeSlot: item.time_slot, currentBlock: item.block }) : setCourseDetailModalCode(item.courseCode)}
                      className={`w-full text-left rounded-xl border border-border-subtle border-l-4 ${spineClass} p-3.5 space-y-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        conflict ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-400' : 'bg-surface hover:bg-surface-muted/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-mono font-bold text-ink tabular-nums">
                          {item.time_slot.replace('/', ' – ')}
                        </p>
                        {conflict && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white flex items-center gap-1 shadow-sm">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Çakışma</span>
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-xs sm:text-sm text-ink">{item.title}</p>
                      {item.detail && (
                        <p className="text-xs text-ink-muted truncate">{item.detail}</p>
                      )}
                      {conflict && (
                        <p className="text-xs text-rose-700 dark:text-rose-300 font-semibold pt-0.5">Bu saatte çakışma var</p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {agendaItems.length > 0 && (
            <button
              type="button"
              onClick={() => setCustomBlockModalData({ day: agendaDay, timeSlot: '12:00 - 12:50', currentBlock: null })}
              className="w-full rounded-xl py-2.5 px-4 bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Etkinlik ekle</span>
            </button>
          )}
        </section>
      )}

      {/* Weekly Timetable Grid */}
      <div
        ref={gridRef}
        data-weekly-grid
        className={`${view === 'week' ? 'flex' : 'hidden'} bg-surface rounded-2xl border border-border-subtle shadow-sm overflow-hidden flex-col min-h-[600px] transition-colors`}
      >
        <div data-grid-scroll className="overflow-x-auto overscroll-x-contain touch-pan-x">
          <table className="w-full table-fixed border-collapse min-w-[700px] text-left">
            {/* Header Days Row */}
            <thead>
              <tr className="bg-surface-muted/80 border-b border-border-subtle">
                <th className="w-20 sm:w-24 p-2.5 text-center text-[11px] font-mono font-bold text-ink-muted uppercase tracking-wider border-r border-border-subtle">
                  Saat
                </th>
                {visibleDays.map(day => (
                  <th
                    key={day}
                    className="p-2.5 text-center text-xs font-bold text-ink tracking-wide border-r border-border-subtle last:border-r-0"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Time Slots Rows */}
            <tbody className="divide-y divide-border-subtle">
              {TIME_SLOTS.map(timeSlot => (
                <tr key={timeSlot} className="hover:bg-surface-muted/30 transition-colors">
                  {/* Time Slot Label */}
                  <td className="p-2 text-center text-[11px] font-mono font-semibold text-ink-muted border-r border-border-subtle bg-surface-muted/40 whitespace-nowrap tabular-nums">
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
                        className="p-1 border-r border-border-subtle last:border-r-0 h-16 align-top relative group"
                      >
                        {/* Empty cell: accessible button to add custom block */}
                        {courses.length === 0 && !customBlock ? (
                          <button
                            type="button"
                            onClick={() => setCustomBlockModalData({ day, timeSlot, currentBlock: null })}
                            aria-label="Özel etkinlik / mola ekle"
                            title="Özel etkinlik / mola ekle"
                            className="w-full h-full min-h-[58px] rounded-lg border border-transparent hover:border-dashed hover:border-border-strong flex items-center justify-center text-ink-muted/30 hover:text-ink hover:bg-surface-muted/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          >
                            <Plus className="w-4 h-4 transition-transform group-hover:scale-110" />
                          </button>
                        ) : (
                          <div className="space-y-1">
                            {/* Conflict Banner if multiple courses or course + block in same slot */}
                            {hasConflict && (
                              <div className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold flex items-center gap-1 shadow-sm">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>ÇAKIŞMA!</span>
                              </div>
                            )}

                            {/* Custom Block */}
                            {customBlock && (
                              <button
                                type="button"
                                onClick={() => setCustomBlockModalData({ day, timeSlot, currentBlock: customBlock })}
                                title="Düzenlemek veya silmek için tıklayın"
                                aria-label={`${customBlock.title} etkinliğini düzenle veya sil`}
                                className={`w-full text-left p-1.5 rounded-lg border border-border-subtle border-l-4 ${
                                  (CUSTOM_BLOCK_COLORS[customBlock.color] || CUSTOM_BLOCK_COLORS.amber).spine
                                } bg-surface hover:bg-surface-muted/50 text-[11px] shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
                              >
                                <div className="font-bold text-ink truncate">{customBlock.title}</div>
                                {customBlock.note && (
                                  <div className="text-[9px] text-ink-muted truncate">{customBlock.note}</div>
                                )}
                              </button>
                            )}

                            {/* Courses */}
                            {courses.map((c, i) => {
                              const palette = getCourseColorPalette[c.course_code] || COURSE_PALETTES[0];
                              const selectedPaletteIndex = COURSE_PALETTES.indexOf(palette);

                              return (
                                <div
                                  key={`${c.course_code}-${c.section_no}-${i}`}
                                  className={`group/course p-1.5 rounded-lg border border-border-subtle border-l-4 ${palette.spine} bg-surface hover:bg-surface-muted/50 text-xs shadow-sm transition-colors`}
                                  title={`${c.course_code} Sec ${c.section_no} - ${c.instructor}`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setCourseDetailModalCode(c.course_code)}
                                    className="w-full text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-brand rounded"
                                    aria-label={`${c.course_code} Şube ${c.section_no} - Ders detayları`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-mono font-bold text-xs text-ink tracking-tight">{c.course_code}</span>
                                      <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${palette.tag}`}>
                                        S.{c.section_no}
                                      </span>
                                    </div>

                                    <div className="text-[10px] text-ink-muted truncate mt-0.5 flex items-center gap-1">
                                      {c.classroom && (
                                        <span className="font-semibold text-ink flex items-center gap-0.5">
                                          <MapPin className="w-2.5 h-2.5 text-ink-muted" /> {c.classroom}
                                        </span>
                                      )}
                                      {c.instructor && (
                                        <span className="truncate">
                                          • {c.instructor}
                                        </span>
                                      )}
                                    </div>
                                  </button>

                                  {/* Color Selector Bar: Keyboard accessible and visible */}
                                  <div className="mt-1 pt-1 border-t border-border-subtle/40 flex items-center gap-1 opacity-60 group-hover/course:opacity-100 focus-within:opacity-100 transition-opacity">
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
                                        className={`w-3 h-3 rounded-full ${option.swatch} ${
                                          paletteIndex === selectedPaletteIndex
                                            ? 'ring-2 ring-offset-1 ring-ink'
                                            : 'opacity-70 hover:opacity-100'
                                        } transition-all hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
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
