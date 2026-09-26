import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSchedule } from '../context/useSchedule';
import { loginSports, fetchSportsSlots, bookSportsSlot } from '../services/sportsApi';
import { parseTimeRange, DAYS } from '../utils/plan';
import {
  Dumbbell,
  X,
  Lock,
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LogOut,
  PlusCircle,
  RefreshCw,
  Info
} from 'lucide-react';

const TURKISH_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function formatDateToTurkish(dateStr) {
  // Converts "YYYY-MM-DD" to "DD.MM.YYYY"
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDate(dateStr, daysToAdd) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + daysToAdd);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function SportsBookingModal() {
  const {
    sportsModalOpen,
    setSportsModalOpen,
    sportsSessionToken,
    setSportsSessionToken,
    sportsUser,
    setSportsUser,
    logoutSports,
    selectedCombination,
    customBlocks,
    setCustomBlock,
    notify
  } = useSchedule();

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Dashboard state
  const [selectedDate, setSelectedDate] = useState(() => getTodayString());
  const [slots, setSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [bookingSeansId, setBookingSeansId] = useState(null);
  const [bookedSlots, setBookedSlots] = useState({}); // seans_id -> { message, addedToTimetable }

  // Close on Escape key
  useEffect(() => {
    if (!sportsModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSportsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sportsModalOpen, setSportsModalOpen]);

  // Compute Turkish day name for the selected date
  const selectedDayName = useMemo(() => {
    if (!selectedDate) return '';
    const d = new Date(`${selectedDate}T00:00:00`);
    return TURKISH_DAYS[d.getDay()] || '';
  }, [selectedDate]);

  // Fetch slots whenever authenticated and selectedDate changes
  const loadSlots = useCallback(async (date) => {
    if (!sportsSessionToken || !date) return;
    setIsLoadingSlots(true);
    setSlotsError('');
    try {
      const formattedDate = formatDateToTurkish(date);
      const data = await fetchSportsSlots(sportsSessionToken, formattedDate, '4', '8');
      setSlots(data);
    } catch (err) {
      if (err.message && err.message.includes('süresi doldu')) {
        notify('Oturum süreniz doldu, lütfen tekrar giriş yapın.');
        logoutSports();
      } else {
        setSlotsError(err.message || 'Seanslar yüklenirken hata oluştu.');
      }
    } finally {
      setIsLoadingSlots(false);
    }
  }, [sportsSessionToken, logoutSports, notify]);

  useEffect(() => {
    if (sportsSessionToken && selectedDate) {
      loadSlots(selectedDate);
    }
  }, [sportsSessionToken, selectedDate, loadSlots]);

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setLoginError('Kullanıcı adı ve şifre gereklidir.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await loginSports(username.trim(), password);
      if (res.token) {
        setSportsSessionToken(res.token);
        setSportsUser({
          username: res.username || username.trim(),
          student_name: res.student_name || username.trim()
        });
        setPassword(''); // Immediately clear password from React state
        notify('Spor randevu sistemine başarıyla bağlanıldı.', 'success');
      } else {
        setLoginError('Oturum başlatılamadı.');
      }
    } catch (err) {
      setLoginError(err.message || 'Giriş yapılamadı.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Clash detection for a given time slot against active timetable & custom blocks
  const checkClash = useCallback((timeSlotStr) => {
    if (!selectedDayName || !timeSlotStr) return null;
    const slotRange = parseTimeRange(timeSlotStr);
    if (!slotRange) return null;

    // 1. Check against selected combination sections
    if (selectedCombination?.sections) {
      for (const sec of selectedCombination.sections) {
        if (!Array.isArray(sec.slots)) continue;
        for (const s of sec.slots) {
          if (s.day === selectedDayName) {
            const courseRange = parseTimeRange(s.time_slot);
            if (courseRange) {
              // Overlap check: start1 < end2 && start2 < end1
              if (slotRange[0] < courseRange[1] && courseRange[0] < slotRange[1]) {
                return {
                  kind: 'course',
                  title: `${sec.course_code} (Şube ${sec.section_no})`,
                  timeSlot: s.time_slot,
                  classroom: s.classroom || sec.classroom || ''
                };
              }
            }
          }
        }
      }
    }

    // 2. Check against custom blocks
    if (customBlocks) {
      for (const block of Object.values(customBlocks)) {
        if (block.day === selectedDayName) {
          const blockRange = parseTimeRange(block.time_slot);
          if (blockRange) {
            if (slotRange[0] < blockRange[1] && blockRange[0] < slotRange[1]) {
              return {
                kind: 'customBlock',
                title: block.title || 'Özel Etkinlik',
                timeSlot: block.time_slot
              };
            }
          }
        }
      }
    }

    return null;
  }, [selectedDayName, selectedCombination, customBlocks]);

  // Handle Book Slot
  const handleBook = async (slot) => {
    if (!slot.seans_id) return;
    setBookingSeansId(slot.seans_id);
    try {
      const res = await bookSportsSlot(sportsSessionToken, slot.seans_id);
      if (res.success) {
        notify(res.message || 'Randevunuz başarıyla oluşturuldu!', 'success');
        setBookedSlots(prev => ({
          ...prev,
          [slot.seans_id]: { message: res.message, addedToTimetable: false, slot }
        }));
        // Refresh slots to see updated counts
        loadSlots(selectedDate);
      } else {
        notify(res.message || 'Randevu alınamadı.', 'error');
      }
    } catch (err) {
      notify(`Randevu alma hatası: ${err.message}`, 'error');
    } finally {
      setBookingSeansId(null);
    }
  };

  // Add booked slot to weekly timetable as Custom Block
  const handleAddToTimetable = (slot) => {
    if (!slot || !selectedDayName) return;
    setCustomBlock(
      selectedDayName,
      slot.time_slot,
      'Spor / Fitness',
      'Çankaya Spor Merkezi Randevusu',
      'purple'
    );
    setBookedSlots(prev => ({
      ...prev,
      [slot.seans_id]: { ...prev[slot.seans_id], addedToTimetable: true }
    }));
    notify(`${selectedDayName} ${slot.time_slot} saati haftalık ders programınıza eklendi!`, 'success');
  };

  if (!sportsModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sports-modal-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-dark-border overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">

        {/* Modal Header */}
        <div className="p-4 sm:px-6 bg-slate-50 dark:bg-dark-card border-b border-slate-200 dark:border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/10 dark:bg-purple-400/15 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h2 id="sports-modal-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-dark-text flex items-center gap-2">
                Spor Tesisi Randevu Sistemi
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-200 dark:bg-dark-border text-slate-600 dark:text-slate-300">
                  randevu.cankaya.edu.tr
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-dark-subtext">
                Fitness ve spor salonu seansları • Çakışma kontrolü & programa ekleme
              </p>
            </div>
          </div>

          <button
            onClick={() => setSportsModalOpen(false)}
            aria-label="Kapat"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-border/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* VIEW 1: LOGIN REQUIRED */}
          {!sportsSessionToken ? (
            <div className="space-y-4 max-w-md mx-auto py-2">
              {/* Security info card */}
              <div className="p-3.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/30 flex items-start gap-3 text-xs text-purple-900 dark:text-purple-300">
                <Lock className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-purple-950 dark:text-purple-200">
                    Sıfır Güvenlik Riski & Şifresiz Mimari
                  </p>
                  <p className="leading-relaxed text-[11px] text-purple-800/90 dark:text-purple-300/90">
                    Öğrenci şifreniz hiçbir zaman veritabanında veya tarayıcıda saklanmaz. Sistem doğrudan üniversite sunucusuna bağlanarak geçici oturum oluşturur. Modal kapandığında oturum hafızadan silinir.
                  </p>
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-dark-text mb-1">
                    Öğrenci Numarası / Kullanıcı Adı
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: 202111001/c2111001"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-dark-text mb-1">
                    Şifre
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Randevu sistemi şifreniz"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Üniversite Sistemine Bağlanılıyor...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Güvenli Giriş Yap</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* VIEW 2: AUTHENTICATED DASHBOARD */
            <div className="space-y-5">

              {/* User banner & Logout */}
              <div className="p-3 px-4 rounded-xl bg-slate-100 dark:bg-dark-card border border-slate-200 dark:border-dark-border flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-purple-600/20 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-xs">
                    {sportsUser?.student_name?.[0]?.toUpperCase() || 'Ö'}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-dark-text">
                      {sportsUser?.student_name || sportsUser?.username}
                    </span>
                    <span className="ml-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      ● Oturum Aktif
                    </span>
                  </div>
                </div>

                <button
                  onClick={logoutSports}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-600 dark:text-dark-subtext hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-white dark:hover:bg-dark-border transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Çıkış Yap</span>
                </button>
              </div>

              {/* Date & Facility Controls */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50/50 dark:bg-dark-card/50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-dark-text">
                    <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Tarih Seçimi:</span>
                    <span className="text-purple-700 dark:text-purple-400 font-bold">
                      {formatDateToTurkish(selectedDate)} ({selectedDayName})
                    </span>
                  </div>

                  <button
                    onClick={() => loadSlots(selectedDate)}
                    disabled={isLoadingSlots}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-dark-border text-slate-600 dark:text-dark-subtext hover:bg-white dark:hover:bg-dark-border transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingSlots ? 'animate-spin' : ''}`} />
                    <span>Yenile</span>
                  </button>
                </div>

                {/* Quick Date Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {[
                    { label: 'Bugün', date: getTodayString() },
                    { label: 'Yarın', date: addDaysToDate(getTodayString(), 1) },
                    { label: '+2 Gün', date: addDaysToDate(getTodayString(), 2) },
                    { label: '+3 Gün', date: addDaysToDate(getTodayString(), 3) }
                  ].map(btn => (
                    <button
                      key={btn.label}
                      onClick={() => setSelectedDate(btn.date)}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                        selectedDate === btn.date
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white dark:bg-dark-card text-slate-700 dark:text-dark-text border border-slate-200 dark:border-dark-border hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}

                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="ml-auto px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-800 dark:text-dark-text focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Slots List Header */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-dark-subtext px-1">
                <span>Fitness Seansları (Merkez Kampüs Spor Salonu)</span>
                <span>{slots.length} Seans Listelendi</span>
              </div>

              {/* Loading & Error Indicators */}
              {isLoadingSlots && (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-dark-subtext">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600 dark:text-purple-400" />
                  <span className="text-xs">Seans bilgileri randevu sisteminden alınıyor...</span>
                </div>
              )}

              {slotsError && !isLoadingSlots && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Seanslar Alınamadı</p>
                    <p>{slotsError}</p>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!isLoadingSlots && !slotsError && slots.length === 0 && (
                <div className="py-10 text-center space-y-2 rounded-xl border border-dashed border-slate-200 dark:border-dark-border p-6 text-slate-500 dark:text-dark-subtext">
                  <Calendar className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600 opacity-60" />
                  <p className="text-xs font-medium">Bu tarih ({formatDateToTurkish(selectedDate)}) için kayıtlı seans bulunamadı.</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Lütfen başka bir gün veya hafta içi bir tarih seçmeyi deneyin.</p>
                </div>
              )}

              {/* Slots Cards */}
              {!isLoadingSlots && slots.length > 0 && (
                <div className="space-y-3">
                  {slots.map((slot, index) => {
                    const clash = checkClash(slot.time_slot);
                    const bookingState = bookedSlots[slot.seans_id];
                    const isBooked = !!bookingState;
                    const isBusy = bookingSeansId === slot.seans_id;

                    const occRatio = slot.capacity && slot.occupied != null
                      ? Math.min(slot.occupied / slot.capacity, 1)
                      : 0;

                    let occColor = 'bg-emerald-500';
                    if (slot.is_full || occRatio >= 1) occColor = 'bg-rose-500';
                    else if (occRatio >= 0.75) occColor = 'bg-amber-500';

                    return (
                      <div
                        key={slot.seans_id || index}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                          isBooked
                            ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800'
                            : clash
                            ? 'bg-amber-50/30 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/60'
                            : 'bg-white dark:bg-dark-card border-slate-200 dark:border-dark-border hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

                          {/* Time & Session Info */}
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 dark:text-dark-text flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                {slot.time_slot}
                              </span>
                              <span className="text-xs text-slate-600 dark:text-dark-subtext font-medium">
                                • {slot.seans_adi}
                              </span>
                            </div>

                            {/* Clash badge */}
                            <div>
                              {clash ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/80 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 text-[11px] font-medium border border-amber-300/80 dark:border-amber-800/50">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>
                                    {clash.kind === 'course' ? 'Ders Çakışması:' : 'Etkinlik Çakışması:'} {clash.title} ({clash.timeSlot})
                                  </span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium border border-emerald-200 dark:border-emerald-800/40">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>Ders programınız uygun</span>
                                </div>
                              )}
                            </div>

                            {/* Occupancy bar */}
                            <div className="pt-1 max-w-xs">
                              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-dark-subtext mb-1">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  Doluluk
                                </span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {slot.doluluk || (slot.occupied != null && slot.capacity ? `${slot.occupied}/${slot.capacity}` : '')}
                                </span>
                              </div>
                              {slot.capacity != null && (
                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${occColor} transition-all duration-300`}
                                    style={{ width: `${Math.round(occRatio * 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col sm:items-end gap-2 shrink-0">
                            {isBooked ? (
                              <div className="flex flex-col sm:items-end gap-1.5">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-3 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                  Randevu Alındı
                                </span>

                                {!bookingState.addedToTimetable ? (
                                  <button
                                    onClick={() => handleAddToTimetable(slot)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5" />
                                    <span>Haftalık Programa Ekle</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Programa Eklendi
                                  </span>
                                )}
                              </div>
                            ) : slot.is_full ? (
                              <button
                                disabled
                                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-dark-card text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-dark-border"
                              >
                                Kontenjan Dolu
                              </button>
                            ) : (
                              <button
                                onClick={() => handleBook(slot)}
                                disabled={isBusy}
                                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition flex items-center gap-1.5 ${
                                  clash
                                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                    : 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
                                }`}
                              >
                                {isBusy ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Alınıyor...</span>
                                  </>
                                ) : (
                                  <>
                                    <Dumbbell className="w-3.5 h-3.5" />
                                    <span>Randevu Al</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:px-6 bg-slate-50 dark:bg-dark-card border-t border-slate-200 dark:border-dark-border flex items-center justify-between text-xs text-slate-500 dark:text-dark-subtext">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Tesis randevuları haftalık olarak okul tarafından güncellenir.</span>
          </div>

          <button
            onClick={() => setSportsModalOpen(false)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-700 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
}
