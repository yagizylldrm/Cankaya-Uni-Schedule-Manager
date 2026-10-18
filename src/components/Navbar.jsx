import React, { useEffect, useRef, useState } from 'react';
import { useSchedule } from '../context/useSchedule';
import PlanTransfer from './PlanTransfer';
import DraftManager from './DraftManager';
import CustomBlocksManager from './CustomBlocksManager';
import AppDialog from './AppDialog';
import AIAssistantModal from './AIAssistantModal';
import { buildSharePayload } from '../utils/plan';
import {
  Sun,
  Moon,
  FileText,
  Download,
  Image as ImageIcon,
  FileJson,
  Printer,
  Layers,
  Dumbbell,
  Wrench,
  Share2,
  CalendarDays,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Bot
} from 'lucide-react';
import html2canvas from 'html2canvas';

export default function Navbar({
  timetableRef,
  onShowSchedule,
  mobileToolsOpen = false,
  onCloseMobileTools
}) {
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
    sportsModalOpen,
    setSportsModalOpen,
    profile,
    drafts,
    canExport,
    isScheduleStale,
    notify,
    activeDraftId
  } = useSchedule();

  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [includeShareActivities, setIncludeShareActivities] = useState(false);
  const [includeShareNotes, setIncludeShareNotes] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [transferMode, setTransferMode] = useState(null);
  const [manager, setManager] = useState(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const toolsMenuRef = useRef(null);
  const toolsTriggerRef = useRef(null);

  // Close tools menu on click outside or Escape
  useEffect(() => {
    if (!isToolsOpen) return;
    const outside = (event) => {
      if (!toolsMenuRef.current?.contains(event.target)) {
        setIsToolsOpen(false);
      }
    };
    const escape = (event) => {
      if (event.key === 'Escape') {
        setIsToolsOpen(false);
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [isToolsOpen]);

  const basketCount = Object.keys(basket).length;
  const passedCount = Object.keys(profile.passedCourses || {}).length;
  const activeDraft = drafts?.find((d) => d.id === activeDraftId) || drafts?.[0];

  // Export as PNG image with deterministic paper/canvas background
  const handleExportPNG = async () => {
    setIsToolsOpen(false);
    if (!timetableRef.current || !canExport) return;

    setExporting(true);
    try {
      const canvas = await html2canvas(timetableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: theme === 'dark' ? '#121212' : '#F7F7F3',
        onclone: (doc) => {
          const grid = doc.querySelector('[data-weekly-grid]');
          if (grid) {
            for (let el = grid; el && el !== doc.body; el = el.parentElement) {
              el.style.display = 'block';
            }
            grid.style.width = '1000px';
            const scrollContainer = grid.querySelector('[data-grid-scroll]');
            if (scrollContainer) {
              scrollContainer.style.overflow = 'visible';
            }
            grid.querySelectorAll('.truncate').forEach((el) => {
              el.style.display = 'block';
              el.style.overflow = 'visible';
              el.style.whiteSpace = 'normal';
              el.style.lineHeight = '20px';
              el.style.minHeight = '24px';
            });
          }
        },
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

  const handleExportJSON = () => {
    setIsToolsOpen(false);
    setTransferMode('save');
  };

  const handlePrint = () => {
    setIsToolsOpen(false);
    if (!canExport) return;
    window.print();
  };

  const openShareModal = () => {
    setIsToolsOpen(false);
    setShareModalOpen(true);
  };

  const handleShare = async () => {
    if (!canExport) return;
    try {
      const encoded = buildSharePayload({
        version: 1,
        basket,
        preferences,
        customBlocks: includeShareActivities
          ? Object.fromEntries(
              Object.entries(customBlocks).map(([key, block]) => [
                key,
                { ...block, note: includeShareNotes ? block.note : '' },
              ])
            )
          : {},
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
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-border-subtle transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          {/* Brand & Editorial Title */}
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/icon-192.png"
              alt="Çankaya Üniversitesi Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-border-subtle object-cover shrink-0 shadow-sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-base sm:text-lg font-bold text-ink leading-tight truncate">
                  Çankaya Program Yöneticisi
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <span className="truncate max-w-[140px] sm:max-w-[200px]" title={activeDraft?.name || 'Ana Taslak'}>
                  {activeDraft?.name || 'Ana Taslak'}
                </span>
                <span className="text-border-strong">·</span>
                {isGenerating ? (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Güncelleniyor…</span>
                  </span>
                ) : isScheduleStale ? (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-3 h-3" />
                    <span>Sonuç bekleniyor</span>
                  </span>
                ) : selectedCombination ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Güncel</span>
                  </span>
                ) : (
                  <span>Ders seçimi bekleniyor</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Tools & Menu */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Açık temaya geç' : 'Karanlık temaya geç'}
              title={theme === 'dark' ? 'Açık temaya geç' : 'Karanlık temaya geç'}
              className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted border border-border-subtle transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-brand" /> : <Moon className="w-4 h-4 text-ink" />}
            </button>

            {/* Planlar Quick Link */}
            <button
              type="button"
              onClick={() => setManager('drafts')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-ink bg-surface-muted hover:bg-surface border border-border-subtle transition-colors"
            >
              <Layers className="w-4 h-4 text-ink-muted" />
              <span>Planlar</span>
              {drafts?.length > 1 && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-surface border border-border-subtle text-ink-muted rounded-full text-[10px] font-bold">
                  {drafts.length}
                </span>
              )}
            </button>

            {/* AI Program Assistant (Desktop) */}
            <button
              type="button"
              onClick={() => setAiModalOpen(true)}
              aria-label="Yapay Zeka Asistanı"
              title="Yapay Zeka ile Doğal Dilde Program Seç"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg text-ink bg-brand hover:bg-brand-hover shadow-xs transition-colors"
            >
              <Sparkles className="w-4 h-4 text-ink" />
              <span className="hidden md:inline">Yapay Zeka Asistanı</span>
              <span className="md:hidden">Asistan</span>
            </button>

            {/* Transcript Quick Link (Desktop) */}
            <button
              type="button"
              onClick={() => setTranscriptModalOpen(true)}
              aria-label="Transkript & Ön Koşul"
              title="Transkript & Ön Koşul"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-ink bg-surface-muted hover:bg-surface border border-border-subtle transition-colors"
            >
              <FileText className="w-4 h-4 text-ink-muted" />
              <span className="hidden lg:inline">Transkript & Ön Koşul</span>
              <span className="lg:hidden">Transkript</span>
              {passedCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-bold">
                  {passedCount}
                </span>
              )}
            </button>

            {/* Sports Booking Quick Link (Desktop) */}
            <button
              id="sports-modal-trigger"
              type="button"
              onClick={() => setSportsModalOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={sportsModalOpen}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-ink bg-surface-muted hover:bg-surface border border-border-subtle transition-colors"
              title="Çankaya Üniversitesi Spor Tesisi Randevu Sistemi (randevu.cankaya.edu.tr)"
            >
              <Dumbbell className="w-4 h-4 text-ink-muted" />
              <span>Spor Randevusu</span>
            </button>

            {/* Unified Tools & Export Dropdown */}
            <div ref={toolsMenuRef} className="relative">
              <button
                ref={toolsTriggerRef}
                type="button"
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                disabled={exporting}
                aria-label="Programı kaydet veya yükle"
                aria-expanded={isToolsOpen}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-ink bg-surface-muted hover:bg-surface border border-border-subtle transition-colors"
              >
                <Wrench className="w-4 h-4 text-ink-muted" />
                <span className="hidden sm:inline">Araçlar & Dışa Aktar</span>
                <span className="sm:hidden">Araçlar</span>
              </button>

              {isToolsOpen && (
                <div
                  className="absolute right-0 mt-2 w-72 bg-surface rounded-xl shadow-xl border border-border-subtle py-1.5 z-50 text-sm divide-y divide-border-subtle"
                >
                  {/* Status Note if stale */}
                  {isScheduleStale && (
                    <div className="px-4 py-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30">
                      Program güncel değil; yeni sonuç bekleniyor.
                    </div>
                  )}

                  {/* Program Management */}
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAiModalOpen(true);
                        setIsToolsOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-surface-muted text-ink font-medium"
                    >
                      <Sparkles className="w-4 h-4 text-brand" />
                      <span>Yapay Zeka Program Asistanı</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTransferMode('load');
                        setIsToolsOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-surface-muted text-ink"
                    >
                      <Download className="w-4 h-4 text-ink-muted" />
                      <span>Kayıtlı programı yükle</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManager('blocks');
                        setIsToolsOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-surface-muted text-ink"
                    >
                      <CalendarDays className="w-4 h-4 text-ink-muted" />
                      <span>Özel etkinlikler ve molalar</span>
                    </button>
                  </div>

                  {/* Export Options */}
                  <div className="py-1">
                    {!canExport && !isScheduleStale && (
                      <p className="px-4 py-1.5 text-xs text-ink-muted">
                        {isGenerating ? 'Program güncelleniyor…' : 'Dışa aktarmak için önce bir ders ekleyin.'}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleExportPNG}
                      disabled={!canExport}
                      className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-surface-muted text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <ImageIcon className="w-4 h-4 text-ink-muted" />
                      <span>PNG Görsel Olarak</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportJSON}
                      disabled={!canExport}
                      className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-surface-muted text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <FileJson className="w-4 h-4 text-ink-muted" />
                      <span>Programı kaydet (JSON)</span>
                    </button>
                    <button
                      type="button"
                      disabled={!canExport}
                      onClick={() => {
                        setTransferMode('calendar');
                        setIsToolsOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-surface-muted text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <CalendarDays className="w-4 h-4 text-ink-muted" />
                      <span>Takvime aktar (.ics)</span>
                    </button>
                    <button
                      type="button"
                      disabled={!canExport}
                      onClick={() => {
                        setTransferMode('csv');
                        setIsToolsOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-surface-muted text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-ink-muted" />
                      <span>CSV olarak indir</span>
                    </button>
                    <button
                      type="button"
                      disabled={!canExport}
                      onClick={openShareModal}
                      className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-surface-muted text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <Share2 className="w-4 h-4 text-ink-muted" />
                      <span>Paylaş</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      disabled={!canExport}
                      className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-surface-muted text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <Printer className="w-4 h-4 text-ink-muted" />
                      <span>Yazdır / PDF</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Dialogs */}
      {aiModalOpen && (
        <AIAssistantModal
          isOpen={true}
          onClose={() => setAiModalOpen(false)}
        />
      )}
      {transferMode && (
        <PlanTransfer
          mode={transferMode}
          onClose={() => setTransferMode(null)}
          onRestored={onShowSchedule}
          restoreFocusRef={toolsTriggerRef}
        />
      )}
      {manager === 'drafts' && <DraftManager onClose={() => setManager(null)} />}
      {manager === 'blocks' && <CustomBlocksManager onClose={() => setManager(null)} />}
      {shareModalOpen && (
        <AppDialog
          isOpen={true}
          onClose={() => setShareModalOpen(false)}
          title="Programı Paylaş"
          description="Yerel ders seçimlerinizi ve programınızı bir bağlantı ile salt-okunur olarak paylaşın. Transkript ve notlarınız dahil edilmez."
          restoreFocusRef={toolsTriggerRef}
          size="md"
          footer={
            <>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border-subtle text-ink font-medium hover:bg-surface-muted transition text-sm"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="primary-action text-sm"
              >
                Linki Kopyala
              </button>
            </>
          }
        >
          <div className="space-y-3 py-1">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-border-subtle bg-surface-muted hover:bg-surface transition cursor-pointer">
              <input
                type="checkbox"
                checked={includeShareActivities}
                onChange={(event) => setIncludeShareActivities(event.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-border-subtle text-brand focus:ring-brand"
              />
              <div>
                <span className="block text-sm font-medium text-ink">Kişisel etkinlikleri dahil et</span>
                <span className="block text-xs text-ink-muted">Özel etkinlikleriniz paylaşım bağlantısına eklenir.</span>
              </div>
            </label>

            {includeShareActivities && (
              <label className="flex items-start gap-3 p-3 rounded-xl border border-border-subtle bg-surface-muted hover:bg-surface transition cursor-pointer ml-6">
                <input
                  type="checkbox"
                  checked={includeShareNotes}
                  onChange={(event) => setIncludeShareNotes(event.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-border-subtle text-brand focus:ring-brand"
                />
                <div>
                  <span className="block text-sm font-medium text-ink">Etkinlik notlarını dahil et</span>
                  <span className="block text-xs text-ink-muted">
                    Özel etkinliklerinize eklediğiniz notlar da paylaşılır.
                  </span>
                </div>
              </label>
            )}
          </div>
        </AppDialog>
      )}

      {/* Mobile "Daha" Tools Dialog */}
      {mobileToolsOpen && (
        <AppDialog
          isOpen={true}
          onClose={onCloseMobileTools}
          title="Daha Fazla Araç"
          description="Plan taslakları, transkript, etkinlikler ve dışa aktarma seçenekleri."
          size="md"
        >
          <div className="space-y-4 py-1 text-sm">
            {/* Status note if stale */}
            {isScheduleStale && (
              <div className="p-3 rounded-xl text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                Program güncel değil; yeni sonuç bekleniyor.
              </div>
            )}

            {/* Management Group */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Yönetim & Akıllı Araçlar
              </p>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobileTools?.();
                    setAiModalOpen(true);
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-left flex items-center justify-between rounded-xl bg-brand hover:bg-brand-hover text-ink font-semibold transition shadow-xs"
                >
                  <span className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-ink" />
                    <span>Yapay Zeka Asistanı</span>
                  </span>
                  <span className="px-2 py-0.5 bg-ink text-surface rounded-full text-xs font-bold">
                    Doğal Dil
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCloseMobileTools?.();
                    setTranscriptModalOpen(true);
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-left flex items-center justify-between rounded-xl bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-medium transition"
                >
                  <span className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-ink-muted" />
                    <span>Transkript & Ön Koşul</span>
                  </span>
                  {passedCount > 0 && (
                    <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-full text-xs font-bold">
                      {passedCount} ders
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCloseMobileTools?.();
                    setSportsModalOpen(true);
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-left flex items-center gap-2.5 rounded-xl bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-medium transition"
                >
                  <Dumbbell className="w-4 h-4 text-ink-muted" />
                  <span>Spor tesisi randevusu</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCloseMobileTools?.();
                    setManager('drafts');
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-left flex items-center justify-between rounded-xl bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-medium transition"
                >
                  <span className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-ink-muted" />
                    <span>Plan taslakları</span>
                  </span>
                  <span className="text-xs text-ink-muted font-bold">
                    {drafts?.length || 1} taslak
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCloseMobileTools?.();
                    setManager('blocks');
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-left flex items-center gap-2.5 rounded-xl bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-medium transition"
                >
                  <CalendarDays className="w-4 h-4 text-ink-muted" />
                  <span>Özel etkinlikler ve molalar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCloseMobileTools?.();
                    setTransferMode('load');
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-left flex items-center gap-2.5 rounded-xl bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-medium transition"
                >
                  <Download className="w-4 h-4 text-ink-muted" />
                  <span>Kayıtlı programı yükle</span>
                </button>
              </div>
            </div>

            {/* Export & Sharing Group */}
            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Dışa Aktar & Paylaş
              </p>
              {!canExport && !isScheduleStale && (
                <p className="text-xs text-ink-muted">
                  {isGenerating ? 'Program güncelleniyor…' : 'Dışa aktarmak için önce bir ders ekleyin.'}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={!canExport}
                  onClick={() => {
                    onCloseMobileTools?.();
                    handleExportJSON();
                  }}
                  className="min-h-[44px] px-3.5 py-2.5 text-left flex items-center gap-2.5 rounded-xl bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-medium transition disabled:opacity-40"
                >
                  <FileJson className="w-4 h-4 text-ink-muted" />
                  <span>Programı kaydet (JSON)</span>
                </button>

                <button
                  type="button"
                  disabled={!canExport}
                  onClick={() => {
                    onCloseMobileTools?.();
                    setTransferMode('calendar');
                  }}
                  className="min-h-[44px] px-3.5 py-2.5 text-left flex items-center gap-2.5 rounded-xl bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-medium transition disabled:opacity-40"
                >
                  <CalendarDays className="w-4 h-4 text-ink-muted" />
                  <span>Takvime aktar (.ics)</span>
                </button>

                <button
                  type="button"
                  disabled={!canExport}
                  onClick={() => {
                    onCloseMobileTools?.();
                    setTransferMode('csv');
                  }}
                  className="min-h-[44px] px-3.5 py-2.5 text-left flex items-center gap-2.5 rounded-xl bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-medium transition disabled:opacity-40"
                >
                  <FileSpreadsheet className="w-4 h-4 text-ink-muted" />
                  <span>CSV olarak indir</span>
                </button>

                <button
                  type="button"
                  disabled={!canExport}
                  onClick={() => {
                    onCloseMobileTools?.();
                    openShareModal();
                  }}
                  className="min-h-[44px] px-3.5 py-2.5 text-left flex items-center gap-2.5 rounded-xl bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-medium transition disabled:opacity-40"
                >
                  <Share2 className="w-4 h-4 text-ink-muted" />
                  <span>Paylaş</span>
                </button>

                <button
                  type="button"
                  disabled={!canExport}
                  onClick={() => {
                    onCloseMobileTools?.();
                    handleExportPNG();
                  }}
                  className="min-h-[44px] px-3.5 py-2.5 text-left flex items-center gap-2.5 rounded-xl bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-medium transition disabled:opacity-40"
                >
                  <ImageIcon className="w-4 h-4 text-ink-muted" />
                  <span>PNG Görsel Olarak</span>
                </button>

                <button
                  type="button"
                  disabled={!canExport}
                  onClick={() => {
                    onCloseMobileTools?.();
                    handlePrint();
                  }}
                  className="min-h-[44px] px-3.5 py-2.5 text-left flex items-center gap-2.5 rounded-xl bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-medium transition disabled:opacity-40"
                >
                  <Printer className="w-4 h-4 text-ink-muted" />
                  <span>Yazdır / PDF</span>
                </button>
              </div>
            </div>

            {/* Appearance */}
            <div className="pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full min-h-[44px] px-3.5 py-2.5 text-left flex items-center justify-between rounded-xl bg-surface-muted hover:bg-surface border border-border-subtle text-ink font-medium transition"
              >
                <span className="flex items-center gap-2.5">
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-brand" /> : <Moon className="w-4 h-4 text-ink" />}
                  <span>{theme === 'dark' ? 'Açık temaya geç' : 'Karanlık temaya geç'}</span>
                </span>
              </button>
            </div>
          </div>
        </AppDialog>
      )}
    </>
  );
}
<button onClick={open}>GPA</button>
