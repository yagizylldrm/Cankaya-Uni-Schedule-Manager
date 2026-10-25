import React, { useEffect, useRef, useState } from 'react';
import { ScheduleProvider } from './context/ScheduleContext';
import { useSchedule } from './context/useSchedule';
import { parseSharePayload } from './utils/plan';
import Navbar from './components/Navbar';
import CourseSearchPanel from './components/CourseSearchPanel';
import CombinationBar from './components/CombinationBar';
import TimetableGrid from './components/TimetableGrid';
import CustomBlockModal from './components/CustomBlockModal';
import CourseDetailModal from './components/CourseDetailModal';
import AppDialog from './components/AppDialog';
import {
  Search,
  Calendar,
  MoreHorizontal
} from 'lucide-react';

function AppContent() {
  const gridRef = useRef(null);
  const {
    basket,
    selectedCombination,
    customBlockModalData,
    notice,
    dismissNotice,
    notify
  } = useSchedule();

  const basketCount = Object.keys(basket).length;
  const [sharedPlan, setSharedPlan] = useState(null);
  const [sharedView, setSharedView] = useState(false);

  // Layout states:
  // Mobile workspace switcher: 'courses' | 'schedule'
  const [mobileWorkspace, setMobileWorkspace] = useState(() => (basketCount ? 'schedule' : 'courses'));
  // Mobile "Daha" tools dialog trigger
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);

  const showSearch = () => setMobileWorkspace('courses');
  const showSchedule = () => setMobileWorkspace('schedule');

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get('share');
    if (!encoded) return;
    const plan = parseSharePayload(encoded);
    if (plan) {
      setSharedPlan(plan);
      return;
    }
    notify('Paylaşılan program bağlantısı geçersiz.');
    window.history.replaceState({}, '', '/');
  }, [notify]);

  const dismissSharedPlan = () => {
    setSharedPlan(null);
    window.history.replaceState({}, '', '/');
  };

  const viewSharedPlan = () => {
    setSharedView(true);
    setMobileWorkspace('schedule');
    window.history.replaceState({}, '', '/');
  };

  const closeSharedView = () => {
    setSharedView(false);
    setSharedPlan(null);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-canvas text-ink transition-colors">
      {/* Skip to Main Content Link for Keyboard / Screen Readers */}
      <a href="#main-content" className="skip-link">
        İçeriğe atla
      </a>

      {/* Top Navigation Bar */}
      <Navbar
        timetableRef={gridRef}
        onShowSchedule={showSchedule}
        mobileToolsOpen={mobileToolsOpen}
        onCloseMobileTools={() => setMobileToolsOpen(false)}
      />

      {/* Shared Plan Notification Banner */}
      {sharedPlan && (
        <div
          role="status"
          className="relative z-20 border-b border-border-subtle bg-surface-muted px-4 py-3 text-ink transition-colors"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">Paylaşılan Program</p>
              <p className="text-xs sm:text-sm text-ink-muted">
                Bağlantı yerel planınızı değiştirmeden salt görüntüleme modunda açılabilir.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={viewSharedPlan}
                className="primary-action text-xs sm:text-sm py-1.5 px-3"
              >
                Görüntüle
              </button>
              <button
                type="button"
                onClick={dismissSharedPlan}
                className="rounded-lg px-3 py-1.5 border border-border-subtle text-xs sm:text-sm font-medium hover:bg-surface transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Plan Read-only Dialog */}
      {sharedView && sharedPlan && (
        <AppDialog
          isOpen={true}
          onClose={closeSharedView}
          title="Paylaşılan Program · Salt Görüntüleme"
          description="Bu görünüm yerel taslaklarınızı değiştirmez."
          size="lg"
        >
          <div className="space-y-4">
            {sharedPlan.selectedCombination?.sections.map((section) => (
              <section
                key={`${section.course_code}-${section.section_no}`}
                className="rounded-xl border border-border-subtle bg-surface-muted/50 p-4"
              >
                <h3 className="font-bold text-ink">
                  {section.course_code} · Şube {section.section_no}
                </h3>
                {section.instructor && (
                  <p className="text-xs sm:text-sm text-ink-muted mt-0.5">{section.instructor}</p>
                )}
                <ul className="mt-2 space-y-1 text-xs sm:text-sm text-ink font-mono">
                  {(section.slots || []).map((slot, index) => (
                    <li key={`${slot.day}-${slot.time_slot}-${index}`}>
                      {slot.day} · {slot.time_slot}
                      {slot.classroom ? ` · ${slot.classroom}` : ''}
                    </li>
                  ))}
                  {!section.slots?.length && (
                    <li className="text-ink-muted font-sans">Haftalık ders saati yok</li>
                  )}
                </ul>
              </section>
            ))}
            {Object.values(sharedPlan.customBlocks || {}).map((block, index) => (
              <section
                key={`${block.day}-${block.time_slot}-${index}`}
                className="rounded-xl border border-brand/50 bg-brand/5 p-4"
              >
                <h3 className="font-bold text-ink">{block.title}</h3>
                <p className="text-xs sm:text-sm text-ink-muted">
                  {block.day} · {block.time_slot}
                </p>
                {block.note && <p className="mt-1 text-xs text-ink-muted">{block.note}</p>}
              </section>
            ))}
          </div>
        </AppDialog>
      )}

      {/* Main Workspace Container */}
      <main
        id="main-content"
        className="workspace flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-6 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-8 flex flex-col lg:flex-row gap-4 sm:gap-6 items-start"
      >
        {/* Left Panel: Course selection catalog */}
        <aside
          data-catalog-drawer
          className={`min-w-0 ${
            mobileWorkspace === 'courses' ? 'flex flex-1 w-full' : 'hidden'
          } lg:flex lg:flex-none lg:flex-col lg:sticky lg:top-20 lg:h-[calc(100vh-6.5rem)] lg:w-80 xl:w-96`}
        >
          <div className="flex-1 min-h-0 w-full">
            <CourseSearchPanel />
          </div>
        </aside>

        {/* Right Panel: Combination Bar & Timetable Grid */}
        <section
          data-schedule-panel
          className={`min-w-0 flex-col gap-3 flex-1 w-full ${
            mobileWorkspace === 'schedule' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Combination Navigation & Preference Filters */}
          <CombinationBar onReviewCourses={showSearch} />

          {!basketCount && !selectedCombination && (
            <div className="rounded-xl p-5 bg-surface border border-border-subtle text-sm flex items-start gap-3">
              <Calendar className="w-5 h-5 text-ink-muted shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-ink">Haftanı planlamaya başla</h2>
                <p className="text-ink-muted mt-1 leading-relaxed">Programın henüz boş. Önce almak istediğin dersleri ekle.</p>
              </div>
            </div>
          )}

          {/* Interactive Timetable Grid */}
          <TimetableGrid gridRef={gridRef} />
        </section>
      </main>

      {/* Mobile Bottom Taskbar */}
      <nav
        aria-label="Mobil gezinme çubuğu"
        className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-surface/95 backdrop-blur border-t border-border-subtle pb-[env(safe-area-inset-bottom,0px)] shadow-lg"
      >
        <div className="grid grid-cols-3 h-14 items-stretch text-xs font-medium">
          <button
            type="button"
            onClick={() => setMobileWorkspace('courses')}
            aria-current={mobileWorkspace === 'courses' ? 'page' : undefined}
            aria-label={`Dersler${basketCount > 0 ? ` (${basketCount})` : ''}`}
            className={`flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors ${
              mobileWorkspace === 'courses'
                ? 'text-ink font-semibold border-t-2 border-brand bg-surface-muted/40'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <div className="relative">
              <Search className="w-4 h-4" />
              {basketCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-brand text-stone-900 font-bold text-[9px]">
                  {basketCount}
                </span>
              )}
            </div>
            <span>Dersler {basketCount > 0 && `(${basketCount})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileWorkspace('schedule')}
            aria-current={mobileWorkspace === 'schedule' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors ${
              mobileWorkspace === 'schedule'
                ? 'text-ink font-semibold border-t-2 border-brand bg-surface-muted/40'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Program</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileToolsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={mobileToolsOpen}
            className="flex flex-col items-center justify-center gap-1 min-h-[44px] text-ink-muted hover:text-ink transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
            <span>Daha</span>
          </button>
        </div>
      </nav>

      {/* Global Modals */}
      {customBlockModalData && (
        <CustomBlockModal key={`${customBlockModalData.day}:${customBlockModalData.timeSlot}`} />
      )}
      <CourseDetailModal />

      {/* Notification Toast */}
      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`fixed bottom-16 sm:bottom-4 left-4 right-4 sm:left-auto sm:w-96 z-[80] rounded-xl border p-4 shadow-xl bg-surface ${
            notice.kind === 'error'
              ? 'border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40'
              : 'border-emerald-300 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm font-medium">{notice.message}</span>
            <button
              onClick={dismissNotice}
              aria-label="Bildirimi kapat"
              className="text-ink-muted hover:text-ink p-1 rounded"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ScheduleProvider>
      <AppContent />
    </ScheduleProvider>
  );
}
