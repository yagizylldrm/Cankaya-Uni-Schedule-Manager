import React, { useEffect, useRef, useState } from 'react';
import { ScheduleProvider } from './context/ScheduleContext';
import { useSchedule } from './context/useSchedule';
import { parseSharePayload } from './utils/plan';
import Navbar from './components/Navbar';
import CourseSearchPanel from './components/CourseSearchPanel';
import CombinationBar from './components/CombinationBar';
import TimetableGrid from './components/TimetableGrid';
import CustomBlockModal from './components/CustomBlockModal';
import TranscriptModal from './components/TranscriptModal';
import CourseDetailModal from './components/CourseDetailModal';
import SportsBookingModal from './components/SportsBookingModal';
import { Search, Calendar } from 'lucide-react';

function AppContent() {
  const gridRef = useRef(null);
  const {
    basket,
    selectedCombination,
    customBlockModalData,
    transcriptModalOpen,
    sportsModalOpen,
    notice,
    dismissNotice,
    notify,
    restorePlan
  } = useSchedule();
  const basketCount = Object.keys(basket).length;
  const [sharedPlan, setSharedPlan] = useState(null);
  const [sharedView, setSharedView] = useState(false);

  // Tab state for mobile screens: 'left' | 'grid'
  const [mobileTab, setMobileTab] = useState(() => basketCount ? 'grid' : 'left');
  const showSearch = () => setMobileTab('left');

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
    setMobileTab('grid');
    window.history.replaceState({}, '', '/');
  };

  const closeSharedView = () => {
    setSharedView(false);
    setSharedPlan(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 dark:bg-dark-bg text-slate-800 dark:text-dark-text transition-colors">
      
      {/* Top Navigation Bar */}
      <Navbar timetableRef={gridRef} onShowSchedule={() => setMobileTab('grid')} />

      {sharedPlan && <div role="status" className="relative z-20 border-b border-cankaya-blue/20 dark:border-cankaya-gold/30 bg-cankaya-blue/10 dark:bg-cankaya-gold/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-cankaya-blue dark:text-cankaya-gold">Paylaşılan Program</p>
            <p className="text-sm text-slate-700 dark:text-dark-text">Bağlantı yerel planınızı değiştirmeden salt görüntüleme modunda açılabilir.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={viewSharedPlan} className="primary-action py-2">Görüntüle</button>
            <button onClick={dismissSharedPlan} className="rounded-xl px-4 py-2 border border-slate-300 dark:border-dark-border text-sm font-semibold">Kapat</button>
          </div>
        </div>
      </div>}

      {sharedView && sharedPlan && <div role="dialog" aria-modal="true" aria-labelledby="shared-view-title" className="fixed inset-0 z-[70] bg-slate-900/60 p-4 overflow-y-auto">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white dark:bg-dark-surface p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 id="shared-view-title" className="text-lg font-bold">Paylaşılan Program · Salt Görüntüleme</h2>
              <p className="text-sm text-slate-500">Bu görünüm yerel taslaklarınızı değiştirmez.</p>
            </div>
            <button onClick={closeSharedView} aria-label="Paylaşılan programı kapat" className="rounded-lg px-3 py-2">✕</button>
          </div>
          <div className="space-y-4">
            {sharedPlan.selectedCombination?.sections.map(section => <section key={`${section.course_code}-${section.section_no}`} className="rounded-xl border border-slate-200 dark:border-dark-border p-4">
              <h3 className="font-bold">{section.course_code} · Şube {section.section_no}</h3>
              {section.instructor && <p className="text-sm text-slate-600 dark:text-dark-subtext">{section.instructor}</p>}
              <ul className="mt-2 space-y-1 text-sm">
                {(section.slots || []).map((slot, index) => <li key={`${slot.day}-${slot.time_slot}-${index}`}>{slot.day} · {slot.time_slot}{slot.classroom ? ` · ${slot.classroom}` : ''}</li>)}
                {!section.slots?.length && <li>Haftalık ders saati yok</li>}
              </ul>
            </section>)}
            {Object.values(sharedPlan.customBlocks || {}).map((block, index) => <section key={`${block.day}-${block.time_slot}-${index}`} className="rounded-xl border border-amber-300 p-4">
              <h3 className="font-bold">{block.title}</h3>
              <p className="text-sm">{block.day} · {block.time_slot}</p>
              {block.note && <p className="mt-1 text-sm text-slate-600 dark:text-dark-subtext">{block.note}</p>}
            </section>)}
          </div>
        </div>
      </div>}

      {/* Mobile View Switcher */}
      <div className="lg:hidden sticky top-[57px] z-20 bg-white/95 dark:bg-dark-surface/95 backdrop-blur border-b border-slate-200 dark:border-dark-border px-3 py-2 flex items-center justify-center gap-2">
        <button
          onClick={() => setMobileTab('left')}
          className={`flex-1 min-h-[42px] py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
            mobileTab === 'left'
              ? 'bg-cankaya-blue text-cankaya-gold'
              : 'bg-slate-100 dark:bg-dark-card text-slate-600 dark:text-dark-text'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Dersler ({basketCount} seçili)</span>
        </button>

        <button
          onClick={() => setMobileTab('grid')}
          className={`flex-1 min-h-[42px] py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
            mobileTab === 'grid'
              ? 'bg-cankaya-blue text-cankaya-gold'
              : 'bg-slate-100 dark:bg-dark-card text-slate-600 dark:text-dark-text'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Haftalık Program</span>
        </button>
      </div>

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">

        {/* Left Panel: Course selection (4 cols on desktop) */}
        <aside className={`lg:col-span-4 min-w-0 flex-col gap-3 h-[75dvh] lg:h-[calc(100vh-6.5rem)] lg:sticky lg:top-20 ${
          mobileTab === 'left' ? 'flex' : 'hidden lg:flex'
        }`}>
          <div className="flex-1 min-h-0">
            <CourseSearchPanel />
          </div>
        </aside>

        {/* Right Panel: Combination Bar & Timetable Grid (8 cols on desktop) */}
        <section data-schedule-panel className={`lg:col-span-8 min-w-0 flex-col gap-3 ${
          mobileTab === 'grid' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Combination Navigation & Preference Filters */}
          <CombinationBar onReviewCourses={showSearch} />

          {!basketCount && !selectedCombination && <div className="rounded-xl p-5 bg-white dark:bg-dark-surface text-sm space-y-3">
            <p>Programın henüz boş. Önce almak istediğin dersleri ekle.</p>
            <button onClick={showSearch} className="primary-action">Ders aramaya başla</button>
          </div>}

          {/* Interactive Timetable Grid */}
          <TimetableGrid gridRef={gridRef} />
        </section>

      </main>

      {/* Global Modals */}
      {customBlockModalData && <CustomBlockModal key={`${customBlockModalData.day}:${customBlockModalData.timeSlot}`} />}
      {transcriptModalOpen && <TranscriptModal />}
      {sportsModalOpen && <SportsBookingModal />}
      <CourseDetailModal />
      {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:w-96 z-[80] rounded-xl border p-4 shadow-xl bg-white dark:bg-dark-surface ${notice.kind === 'error' ? 'border-rose-400 text-rose-700 dark:text-rose-300' : 'border-emerald-400 text-emerald-700 dark:text-emerald-300'}`}>
        <div className="flex items-start justify-between gap-3"><span>{notice.message}</span><button onClick={dismissNotice} aria-label="Bildirimi kapat">✕</button></div>
      </div>}

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
