import React, { useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { generateCombinations } from '../services/api';
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

export default function Navbar({ timetableRef }) {
  const {
    theme,
    toggleTheme,
    basket,
    preferences,
    customBlocks,
    setCombinations,
    setCurrentComboIndex,
    setConflictsInfo,
    isGenerating,
    setIsGenerating,
    setTranscriptModalOpen,
    profile
  } = useSchedule();

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const basketCount = Object.keys(basket).length;
  const passedCount = Object.keys(profile.passedCourses || {}).length;

  // Generate schedule combinations
  const handleGenerate = async () => {
    if (basketCount === 0) {
      alert('Lütfen önce sol panelden alınmak istenen dersleri sepete ekleyin.');
      return;
    }

    setIsGenerating(true);
    setConflictsInfo(null);

    try {
      // Build selected_courses: { [code]: [section_nos] }
      const selectedCourses = {};
      Object.entries(basket).forEach(([code, c]) => {
        selectedCourses[code] = c.selectedSections && c.selectedSections.length > 0
          ? c.selectedSections
          : (c.allSections || []).map(s => String(s.section_no));
      });

      const res = await generateCombinations(selectedCourses, preferences, customBlocks);
      setCombinations(res.combinations || []);
      setCurrentComboIndex(0);

      if (res.count === 0) {
        setConflictsInfo(res.conflicts_info || 'Çakışmasız kombinasyon bulunamadı.');
      }
    } catch (err) {
      alert(`Hata: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Export as PNG image
  const handleExportPNG = async () => {
    setIsExportMenuOpen(false);
    if (!timetableRef.current) return;

    setExporting(true);
    try {
      const canvas = await html2canvas(timetableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: theme === 'dark' ? '#181825' : '#ffffff'
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
    const data = {
      profile,
      basket,
      customBlocks,
      preferences,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `cankaya_program_${new Date().toISOString().slice(0, 10)}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const handlePrint = () => {
    setIsExportMenuOpen(false);
    window.print();
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-dark-surface/95 backdrop-blur border-b border-slate-200 dark:border-dark-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        
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
        <div className="flex items-center gap-2 sm:gap-3">
          
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
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-slate-700 dark:text-dark-text bg-slate-100 dark:bg-dark-card hover:bg-slate-200 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-dark-border transition"
            >
              <Download className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span className="hidden sm:inline">Dışa Aktar</span>
            </button>

            {isExportMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsExportMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-slate-200 dark:border-dark-border py-1.5 z-50 text-sm">
                  <button
                    onClick={handleExportPNG}
                    className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-dark-text"
                  >
                    <ImageIcon className="w-4 h-4 text-blue-500" />
                    <span>PNG Görsel Olarak</span>
                  </button>
                  <button
                    onClick={handleExportJSON}
                    className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-dark-text"
                  >
                    <FileJson className="w-4 h-4 text-amber-500" />
                    <span>JSON Verisi Olarak</span>
                  </button>
                  <button
                    onClick={handlePrint}
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
  );
}
