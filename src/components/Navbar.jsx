import React, { useEffect, useRef, useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import PlanTransfer from './PlanTransfer';
import { 
  GraduationCap, 
  Sun, 
  Moon, 
  FileText, 
  Sparkles, 
  Download, 
  Check, 
  Image as ImageIcon, 
  FileJson,
  Printer
} from 'lucide-react';
import html2canvas from 'html2canvas';

export default function Navbar({ timetableRef, onShowSchedule }) {
  const {
    theme,
    toggleTheme,
    basket,
    isGenerating,
    setTranscriptModalOpen,
    profile,
    generateSchedule,
    canExport,
    isScheduleStale
  } = useSchedule();

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [transferMode, setTransferMode] = useState(null);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!isExportMenuOpen) return;
    const outside = event => { if (!menuRef.current?.contains(event.target)) setIsExportMenuOpen(false); };
    const escape = event => { if (event.key === 'Escape') setIsExportMenuOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [isExportMenuOpen]);

  const basketCount = Object.keys(basket).length;
  const passedCount = Object.keys(profile.passedCourses || {}).length;

  // Generate schedule combinations
  const handleGenerate = async () => {
    onShowSchedule();
    await generateSchedule();
  };

  // Export as PNG image
  const handleExportPNG = async () => {
    setIsExportMenuOpen(false);
    if (!timetableRef.current || !canExport) return;

    setExporting(true);
    try {
      const canvas = await html2canvas(timetableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: theme === 'dark' ? '#181825' : '#ffffff',
        onclone: doc => {
          const grid = doc.querySelector('[data-weekly-grid]');
          if (grid) {
            for (let el = grid; el && el !== doc.body; el = el.parentElement) el.style.display = 'block';
            grid.style.width = '1000px';
            grid.querySelector('[data-grid-scroll]').style.overflow = 'visible';
            grid.querySelectorAll('.truncate').forEach(el => {
              el.style.display = 'block';
              el.style.overflow = 'visible';
              el.style.whiteSpace = 'normal';
              el.style.lineHeight = '20px';
              el.style.minHeight = '24px';
            });
          }
        }
      });
      const link = document.createElement('a');
      link.download = `Cankaya_Ders_Programi_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      alert(`Görsel dışa aktarılırken hata: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Export as JSON
  const handleExportJSON = () => {
    setIsExportMenuOpen(false);
    setTransferMode('save');
  };

  const handlePrint = () => {
    setIsExportMenuOpen(false);
    if (!canExport) return;
    window.print();
  };

  return (
    <>
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-dark-surface/95 backdrop-blur border-b border-slate-200 dark:border-dark-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cankaya-blue flex items-center justify-center text-cankaya-gold shadow-md shadow-cankaya-blue/20">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-cankaya-blue dark:text-cankaya-goldLight leading-tight">
                Çankaya Üniversitesi
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-semibold bg-cankaya-blue/10 dark:bg-cankaya-gold/15 text-cankaya-blue dark:text-cankaya-gold rounded-full border border-cankaya-blue/20 dark:border-cankaya-gold/30">
                v2.0 Web
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-dark-subtext">
              Haftalık Ders Programı & Ön Koşul Yöneticisi
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-card border border-slate-200 dark:border-dark-border transition"
            title={theme === 'cankaya' ? 'Karanlık Temaya Geç' : 'Çankaya Temasına Geç'}
          >
            {theme === 'cankaya' ? <Moon className="w-4 h-4 text-slate-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Transcript & Prerequisite */}
          <button
            onClick={() => setTranscriptModalOpen(true)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-slate-700 dark:text-dark-text bg-slate-100 dark:bg-dark-card hover:bg-slate-200 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-dark-border transition"
          >
            <FileText className="w-4 h-4 text-cankaya-blue dark:text-cankaya-gold" />
            <span className="hidden md:inline">Transkript & Ön Koşul</span>
            <span className="md:hidden">Transkript</span>
            {passedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[10px] font-bold">
                {passedCount}
              </span>
            )}
          </button>

          {/* Export Dropdown */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              disabled={exporting}
              aria-label="Programı kaydet veya yükle"
              aria-expanded={isExportMenuOpen}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-slate-700 dark:text-dark-text bg-slate-100 dark:bg-dark-card hover:bg-slate-200 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-dark-border transition"
            >
              <Download className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span>Kaydet / Yükle</span>
            </button>

            {isExportMenuOpen && (
              <>
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-slate-200 dark:border-dark-border py-1.5 z-50 text-sm">
                  <button onClick={() => { setTransferMode('load'); setIsExportMenuOpen(false); }} className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">Kayıtlı programı yükle</button>
                  {!canExport && <p className="px-4 py-2 text-xs text-amber-700 dark:text-amber-300">{isScheduleStale ? 'Dışa aktarmadan önce programı yeniden oluşturun.' : 'Kaydetmek için önce program oluşturun.'}</p>}
                  <button
                    onClick={handleExportPNG}
                    disabled={!canExport}
                    className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-dark-text"
                  >
                    <ImageIcon className="w-4 h-4 text-blue-500" />
                    <span>PNG Görsel Olarak</span>
                  </button>
                  <button
                    onClick={handleExportJSON}
                    disabled={!canExport}
                    className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-dark-text"
                  >
                    <FileJson className="w-4 h-4 text-amber-500" />
                    <span>Programı kaydet (JSON)</span>
                  </button>
                  <button disabled={!canExport} onClick={() => { setTransferMode('calendar'); setIsExportMenuOpen(false); }} className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">Takvime aktar (.ics)</button>
                  <button disabled={!canExport} onClick={() => { setTransferMode('csv'); setIsExportMenuOpen(false); }} className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">CSV olarak indir</button>
                  <button
                    onClick={handlePrint}
                    disabled={!canExport}
                    className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-dark-text"
                  >
                    <Printer className="w-4 h-4 text-emerald-500" />
                    <span>Yazdır / PDF</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Generate Schedule (Primary Button) */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || basketCount === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition ${
              basketCount === 0
                ? 'bg-slate-200 dark:bg-dark-card text-slate-400 cursor-not-allowed border border-slate-300 dark:border-dark-border'
                : 'bg-cankaya-blue hover:bg-cankaya-navy text-cankaya-gold hover:text-white shadow-cankaya-blue/20 dark:bg-cankaya-gold dark:hover:bg-cankaya-goldLight dark:text-slate-900 cursor-pointer active:scale-95'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Hesaplanıyor...' : 'Program Oluştur'}</span>
          </button>

        </div>
      </div>
    </header>
    {transferMode && <PlanTransfer mode={transferMode} onClose={() => setTransferMode(null)} onRestored={onShowSchedule} />}
    </>
  );
}
