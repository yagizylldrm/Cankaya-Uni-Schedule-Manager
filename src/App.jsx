import React, { useRef, useState } from 'react';
import { ScheduleProvider, useSchedule } from './context/ScheduleContext';
import Navbar from './components/Navbar';
import CourseSearchPanel from './components/CourseSearchPanel';
import CourseBasket from './components/CourseBasket';
import CombinationBar from './components/CombinationBar';
import TimetableGrid from './components/TimetableGrid';
import CustomBlockModal from './components/CustomBlockModal';
import TranscriptModal from './components/TranscriptModal';
import CourseDetailModal from './components/CourseDetailModal';
import { Search, ShoppingBag, Calendar } from 'lucide-react';

function AppContent() {
  const gridRef = useRef(null);
  const { basket, generateSchedule, isGenerating, selectedCombination, customBlockModalData, transcriptModalOpen } = useSchedule();
  const basketCount = Object.keys(basket).length;

  // Tab state for left sidebar: 'search' | 'basket'
  const [leftTab, setLeftTab] = useState('search');

  // Tab state for mobile screens: 'left' | 'grid'
  const [mobileTab, setMobileTab] = useState(() => basketCount ? 'grid' : 'left');
  const showSearch = () => { setMobileTab('left'); setLeftTab('search'); };
  const showBasket = () => { setMobileTab('left'); setLeftTab('basket'); };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 dark:bg-dark-bg text-slate-800 dark:text-dark-text transition-colors">
      
      {/* Top Navigation Bar */}
      <Navbar timetableRef={gridRef} onShowSchedule={() => setMobileTab('grid')} />

      {!selectedCombination && <div className="max-w-7xl mx-auto w-full px-4 pt-4" data-onboarding>
        <div className="rounded-2xl bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border p-4">
          <h2 className="font-bold text-base">Ders programını üç adımda oluştur</h2>
          <p className="text-sm text-slate-600 dark:text-dark-subtext mt-1">Bölümünü seç, derslerini ekle ve sana uygun şubeleri bul.</p>
          <ol className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <li><button className="w-full rounded-xl bg-slate-100 dark:bg-dark-card p-3 text-left" onClick={() => { showSearch(); setTimeout(() => document.getElementById('primary-department')?.focus(), 0); }}>1. Bölümünü seç</button></li>
            <li><button className="w-full rounded-xl bg-slate-100 dark:bg-dark-card p-3 text-left" onClick={showSearch}>2. Dersleri ekle {basketCount > 0 && `(${basketCount} ders eklendi)`}</button></li>
            <li><button className="primary-action w-full text-left" disabled={!basketCount || isGenerating} onClick={() => { setMobileTab('grid'); generateSchedule(); }}>3. {isGenerating ? 'Hesaplanıyor…' : 'Program oluştur'}</button></li>
          </ol>
        </div>
      </div>}

      {/* Mobile View Switcher */}
      <div className="lg:hidden bg-white dark:bg-dark-surface border-b border-slate-200 dark:border-dark-border px-4 py-2 flex items-center justify-center gap-2">
        <button
          onClick={() => setMobileTab('left')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            mobileTab === 'left'
              ? 'bg-cankaya-blue text-cankaya-gold'
              : 'bg-slate-100 dark:bg-dark-card text-slate-600 dark:text-dark-text'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Dersler & Sepet ({basketCount})</span>
        </button>

        <button
          onClick={() => setMobileTab('grid')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
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
        
        {/* Left Panel: Search & Basket (4 cols on desktop) */}
        <aside className={`lg:col-span-4 min-w-0 flex-col gap-3 h-[75dvh] lg:h-[calc(100vh-6.5rem)] lg:sticky lg:top-20 ${
          mobileTab === 'left' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Sidebar Tabs */}
          <div className="flex bg-slate-200/80 dark:bg-dark-card p-1 rounded-xl border border-slate-200 dark:border-dark-border shrink-0">
            <button
              onClick={() => setLeftTab('search')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                leftTab === 'search'
                  ? 'bg-white dark:bg-dark-surface text-cankaya-blue dark:text-cankaya-gold shadow-xs'
                  : 'text-slate-600 dark:text-dark-subtext hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Ders Arama</span>
            </button>

            <button
              onClick={() => setLeftTab('basket')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                leftTab === 'basket'
                  ? 'bg-white dark:bg-dark-surface text-cankaya-blue dark:text-cankaya-gold shadow-xs'
                  : 'text-slate-600 dark:text-dark-subtext hover:text-slate-900'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Ders Sepeti</span>
              {basketCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-cankaya-blue text-cankaya-gold dark:bg-cankaya-gold dark:text-slate-900">
                  {basketCount}
                </span>
              )}
            </button>
          </div>

          {/* Active Tab Panel */}
          <div className="flex-1 min-h-0">
            {leftTab === 'search' ? (
              <CourseSearchPanel />
            ) : (
              <CourseBasket />
            )}
          </div>
        </aside>

        {/* Right Panel: Combination Bar & Timetable Grid (8 cols on desktop) */}
        <section data-schedule-panel className={`lg:col-span-8 min-w-0 flex-col gap-3 ${
          mobileTab === 'grid' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Combination Navigation & Preference Filters */}
          <CombinationBar onReviewBasket={showBasket} />

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
