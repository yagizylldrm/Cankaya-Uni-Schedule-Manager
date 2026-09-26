import React, { useEffect, useRef, useState } from 'react';
import { useSchedule } from '../context/useSchedule';
import PlanTransfer from './PlanTransfer';
import DraftManager from './DraftManager';
import CustomBlocksManager from './CustomBlocksManager';
import { buildSharePayload } from '../utils/plan';
import {
  GraduationCap, 
  Sun, 
  Moon, 
  FileText, 

  Download, 
  Check, 
  Image as ImageIcon,
  FileJson,
  Printer,
  Layers,
  Dumbbell
} from 'lucide-react';
import html2canvas from 'html2canvas';

export default function Navbar({ timetableRef, onShowSchedule }) {
  const {
    theme,
    toggleTheme,
    basket,
    preferences,
    customBlocks,
    selectedCombination,
    semester,
    isGenerating,
    setTranscriptModalOpen,
    setSportsModalOpen,
    profile,
    drafts,
    canExport,
    isScheduleStale,
    notify,
    activeDraftId
  } = useSchedule();

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [includeShareActivities, setIncludeShareActivities] = useState(false);
  const [includeShareNotes, setIncludeShareNotes] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [transferMode, setTransferMode] = useState(null);
  const [manager, setManager] = useState(null);
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

  const activeDraft = drafts?.find(d => d.id === activeDraftId) || drafts?.[0];





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
      notify(`Görsel dışa aktarılırken hata: ${err.message}`);
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

  const openShareModal = () => {
    setIsExportMenuOpen(false);
    setShareModalOpen(true);
  };

  const handleShare = async () => {
    if (!canExport) return;
    try {
      const encoded = buildSharePayload({
        version: 1,
        basket,
        preferences,
        customBlocks: includeShareActivities ? Object.fromEntries(Object.entries(customBlocks).map(([key, block]) =>
          [key, { ...block, note: includeShareNotes ? block.note : '' }])) : {},
        selectedCombination,
        semester,
        program: {
          primaryDept: profile.primaryDept,
          secondaryDept: profile.secondaryDept,
          secondaryType: profile.secondaryType,
        },
      });
      await navigator.clipboard.writeText(`${window.location.origin}/?share=${encoded}`);
      setShareModalOpen(false);
      notify('Paylaşım bağlantısı panoya kopyalandı.', 'success');
    } catch (err) {
      notify(`Paylaşım bağlantısı kopyalanamadı: ${err.message}`);
    }
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
            onClick={() => setManager('drafts')}
            aria-label="Planlar"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-cankaya-blue/10 dark:bg-cankaya-gold/15 text-cankaya-blue dark:text-cankaya-gold border border-cankaya-blue/20 dark:border-cankaya-gold/30 hover:bg-cankaya-blue/20 dark:hover:bg-cankaya-gold/25 transition max-w-[130px] sm:max-w-[190px]"
            title="Plan taslakları ve yönetimi"
          >
            <Layers className="w-3.5 h-3.5 shrink-0 text-cankaya-blue dark:text-cankaya-gold" />
            <span className="truncate">{activeDraft?.name || 'Planlar'}</span>
          </button>
          <button onClick={() => setManager('blocks')} className="hidden sm:inline-flex px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-dark-border text-slate-700 dark:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-card transition" title="Özel etkinlikler ve molalar">Etkinlikler</button>
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

          <button
            onClick={() => setSportsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-slate-700 dark:text-dark-text bg-slate-100 dark:bg-dark-card hover:bg-slate-200 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-dark-border transition"
            title="Çankaya Üniversitesi Spor Tesisi Randevu Sistemi (randevu.cankaya.edu.tr)"
          >
            <Dumbbell className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="hidden md:inline">Spor Randevusu</span>
            <span className="md:hidden">Spor</span>
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
                  {isScheduleStale && <p className="px-4 py-2 text-xs text-amber-700 dark:text-amber-300">Program güncel değil; yeni sonuç bekleniyor.</p>}
                  <button onClick={() => { setTransferMode('load'); setIsExportMenuOpen(false); }} className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">Kayıtlı programı yükle</button>
                  {!canExport && !isScheduleStale && <p className="px-4 py-2 text-xs text-amber-700 dark:text-amber-300">{isGenerating ? 'Program güncelleniyor…' : 'Dışa aktarmak için önce bir ders ekleyin.'}</p>}
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
                  {canExport && (
                    <div className="border-t border-slate-200 dark:border-dark-border mt-1 pt-1">
                      <button
                        type="button"
                        onClick={openShareModal}
                        className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Paylaş
                      </button>
                    </div>
                  )}
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


        </div>
      </div>
    </header>
    {transferMode && <PlanTransfer mode={transferMode} onClose={() => setTransferMode(null)} onRestored={onShowSchedule} />}
    {manager === 'drafts' && <DraftManager onClose={() => setManager(null)} />}
    {manager === 'blocks' && <CustomBlocksManager onClose={() => setManager(null)} />}
    {shareModalOpen && <div role="dialog" aria-modal="true" aria-labelledby="share-modal-title" className="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="share-modal-title" className="text-lg font-bold text-slate-800 dark:text-dark-text">Programı Paylaş</h2>
          <button onClick={() => setShareModalOpen(false)} aria-label="Kapat" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-dark-surface transition">
            ✕
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-dark-surface transition cursor-pointer">
            <input
              type="checkbox"
              checked={includeShareActivities}
              onChange={event => setIncludeShareActivities(event.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <span className="block text-sm font-medium text-slate-700 dark:text-dark-text">Kişisel etkinlikleri dahil et</span>
              <span className="block text-xs text-slate-500 dark:text-dark-subtext">Özel etkinlikleriniz paylaşım linkine eklenir</span>
            </div>
          </label>

          {includeShareActivities && <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-dark-surface transition cursor-pointer ml-7">
            <input
              type="checkbox"
              checked={includeShareNotes}
              onChange={event => setIncludeShareNotes(event.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <span className="block text-sm font-medium text-slate-700 dark:text-dark-text">Etkinlik notlarını dahil et</span>
              <span className="block text-xs text-slate-500 dark:text-dark-subtext">Notlar da paylaşılır</span>
            </div>
          </label>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShareModalOpen(false)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-dark-border text-slate-700 dark:text-dark-text font-medium hover:bg-slate-50 dark:hover:bg-dark-surface transition"
          >
            İptal
          </button>
          <button
            onClick={handleShare}
            className="flex-1 px-4 py-2.5 rounded-xl bg-cankaya-blue text-cankaya-gold font-semibold hover:bg-cankaya-navy transition"
          >
            Linki Kopyala
          </button>
        </div>
      </div>
    </div>}
    </>
  );
}
