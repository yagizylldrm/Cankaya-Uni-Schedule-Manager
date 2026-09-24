import React, { useRef, useState } from 'react';
import { ScheduleProvider } from './context/ScheduleContext';
import { useSchedule } from './context/useSchedule';
import Navbar from './components/Navbar';
import CourseSearchPanel from './components/CourseSearchPanel';
import CombinationBar from './components/CombinationBar';
import TimetableGrid from './components/TimetableGrid';
import CustomBlockModal from './components/CustomBlockModal';
import TranscriptModal from './components/TranscriptModal';
import CourseDetailModal from './components/CourseDetailModal';
import { Search, Calendar } from 'lucide-react';

function AppContent() {
  const gridRef = useRef(null);
  const { basket, selectedCombination, customBlockModalData, transcriptModalOpen } = useSchedule();
  const basketCount = Object.keys(basket).length;

  // Tab state for mobile screens: 'left' | 'grid'
  const [mobileTab, setMobileTab] = useState(() => basketCount ? 'grid' : 'left');
  const showSearch = () => setMobileTab('left');

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 dark:bg-dark-bg text-slate-800 dark:text-dark-text transition-colors">
      
      {/* Top Navigation Bar */}
      <Navbar timetableRef={gridRef} onShowSchedule={() => setMobileTab('grid')} />

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
      <CourseDetailModal />

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
