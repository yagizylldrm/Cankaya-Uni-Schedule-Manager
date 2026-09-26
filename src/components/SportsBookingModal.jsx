import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
const TURKISH_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

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

  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Request sequencing and abort handling
  const activeRequestRef = useRef(0);
  const abortControllerRef = useRef(null);

  // Booking lock
  const bookingLockRef = useRef(false);

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
  const [bookedSlots, setBookedSlots] = useState({}); // seans_id -> { message, addedToTimetable, slot, date, dayName }

  // Native Dialog lifecycle & focus restoration
  useEffect(() => {
    if (!sportsModalOpen) return;

    previousFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
      const trigger = document.getElementById('sports-modal-trigger') || previousFocusRef.current;
      if (trigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
    };
  }, [sportsModalOpen]);

  // Abort pending slot requests on unmount or token change
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [sportsSessionToken]);

  // Compute Turkish day name for the selected date
  const selectedDayName = useMemo(() => {
    if (!selectedDate) return '';
    const d = new Date(`${selectedDate}T00:00:00`);
    return TURKISH_DAYS[d.getDay()] || '';
  }, [selectedDate]);

  const [selectedYear, selectedMonth, selectedDay] = useMemo(
    () => selectedDate.split('-').map(Number),
    [selectedDate]
  );
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const selectableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 3 }, (_, index) => currentYear + index);
  }, []);

  const handleDatePartChange = (part, value) => {
    if (bookingLockRef.current) return;
    let year = selectedYear;
    let month = selectedMonth;
    let day = selectedDay;

    if (part === 'day') day = Number(value);
    if (part === 'month') month = Number(value);
    if (part === 'year') year = Number(value);

    day = Math.min(day, new Date(year, month, 0).getDate());
    setSelectedDate(
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    );
  };

  // Fetch slots whenever authenticated and selectedDate changes
  const loadSlots = useCallback(async (date) => {
    if (!sportsSessionToken || !date) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentReqId = ++activeRequestRef.current;

    setIsLoadingSlots(true);
    setSlotsError('');
    setSlots([]); // Clear previous slots to prevent displaying stale slots during load

    try {
      const formattedDate = formatDateToTurkish(date);
      const data = await fetchSportsSlots(sportsSessionToken, formattedDate, '4', '8', controller.signal);
      if (currentReqId === activeRequestRef.current) {
        setSlots(data);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (currentReqId !== activeRequestRef.current) return;

      if (
        err.code === 'SESSION_INVALID' ||
        err.code === 'SESSION_EXPIRED' ||
        (err.message && (err.message.includes('süresi doldu') || err.message.includes('oturum') || err.message.includes('Giriş')))
      ) {
        notify('Oturum süreniz doldu veya geçersiz. Lütfen tekrar giriş yapın.');
        logoutSports();
      } else {
        setSlotsError(err.message || 'Seanslar yüklenirken hata oluştu.');
      }
    } finally {
      if (currentReqId === activeRequestRef.current) {
        setIsLoadingSlots(false);
      }
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
        notify('Spor randevu sistemine başarıyla bağlanıldı.', 'success');
      } else {
        setLoginError('Oturum başlatılamadı.');
      }
    } catch (err) {
      setLoginError(err.message || 'Giriş yapılamadı.');
    } finally {
      setIsLoggingIn(false);
      setPassword(''); // Password cleared immediately from form state in finally
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
    if (!slot?.seans_id || bookingLockRef.current) return;
    bookingLockRef.current = true;
    setBookingSeansId(slot.seans_id);

    const bookingDateSnapshot = selectedDate;
    const bookingDayNameSnapshot = selectedDayName;

    try {
      const res = await bookSportsSlot(sportsSessionToken, slot.seans_id);
      if (res.success) {
        notify(res.message || 'Randevunuz başarıyla oluşturuldu!', 'success');
        setBookedSlots(prev => ({
          ...prev,
          [slot.seans_id]: {
            message: res.message,
            addedToTimetable: false,
            slot,
            date: bookingDateSnapshot,
            dayName: bookingDayNameSnapshot
          }
        }));
        // Refresh slots to see updated counts
        loadSlots(selectedDate);
      } else {
        notify(res.message || 'Randevu alınamadı.', 'error');
      }
    } catch (err) {
      if (err.code === 'SESSION_INVALID' || err.code === 'SESSION_EXPIRED') {
        notify('Oturum süreniz doldu, lütfen tekrar giriş yapın.');
        logoutSports();
      } else {
        notify(`Randevu alma hatası: ${err.message}`, 'error');
      }
    } finally {
      bookingLockRef.current = false;
      setBookingSeansId(null);
    }
  };

  // Add booked slot to weekly timetable as Custom Block
  const handleAddToTimetable = (slot) => {
    if (!slot) return;
    const bookingInfo = bookedSlots[slot.seans_id];
    const targetDayName = bookingInfo?.dayName || selectedDayName;
    if (!targetDayName) return;

    setCustomBlock(
      targetDayName,
      slot.time_slot,
      'Spor / Fitness',
      'Çankaya Spor Merkezi Randevusu',
      'purple'
    );
    setBookedSlots(prev => ({
      ...prev,
      [slot.seans_id]: { ...prev[slot.seans_id], addedToTimetable: true }
    }));
    notify(`${targetDayName} ${slot.time_slot} saati haftalık ders programınıza eklendi!`, 'success');
  };

  const handleDialogBackdropClick = (e) => {
    if (e.target === dialogRef.current) {
      setSportsModalOpen(false);
    }
  };

  if (!sportsModalOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={() => setSportsModalOpen(false)}
      onClick={handleDialogBackdropClick}
      aria-labelledby="sports-modal-title"
      className="w-[calc(100%_-_1.5rem)] sm:w-full max-w-2xl bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-dark-border p-0 overflow-hidden backdrop:bg-slate-900/60 backdrop:backdrop-blur-xs my-auto mx-auto animate-in fade-in zoom-in-95 duration-150 max-h-[90dvh] flex flex-col"
    >
      {/* Modal Header */}
      <div className="p-4 sm:px-6 bg-slate-50 dark:bg-dark-card border-b border-slate-200 dark:border-dark-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-purple-600/10 dark:bg-purple-400/15 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 id="sports-modal-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-dark-text flex items-center gap-2 flex-wrap">
              <span>Spor Tesisi Randevu Sistemi</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-200 dark:bg-dark-border text-slate-600 dark:text-slate-300">
                randevu.cankaya.edu.tr
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-dark-subtext truncate">
              Fitness ve spor salonu seansları • Çakışma kontrolü & programa ekleme
            </p>
          </div>
        </div>

        <button
          onClick={() => setSportsModalOpen(false)}
          aria-label="Kapat"
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-border/50 transition min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0 ml-2"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Modal Scrollable Content */}
      <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">

        {/* VIEW 1: LOGIN REQUIRED */}
        {!sportsSessionToken ? (
          <div className="space-y-4 max-w-md mx-auto py-2">
            {/* Truthful Security & Privacy info card */}
            <div className="p-3.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/30 flex items-start gap-3 text-xs text-purple-900 dark:text-purple-300">
              <Lock className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-purple-950 dark:text-purple-200">
                  Güvenlik & Gizlilik Bilgilendirmesi
                </p>
                <p className="leading-relaxed text-[11px] text-purple-800/90 dark:text-purple-300/90">
                  Öğrenci şifreniz hiçbir zaman veritabanında veya tarayıcı yerel depolamasında (localStorage) saklanmaz. Giriş isteğiniz doğrudan uygulama sunucusu ve güvenli ngrok tüneli üzerinden üniversite randevu sistemine iletilerek şifreli bir geçici oturum başlatılır. Şifreniz formdan anında silinir; geçici oturum anahtarı ise yalnızca tarayıcı sekmesi belleğinde tutulur. Modalı kapatmak oturumu sonlandırmaz; çıkış yapmak için &ldquo;Çıkış Yap&rdquo; butonunu kullanabilir veya sayfayı yenileyebilirsiniz.
                </p>
              </div>
            </div>

            {loginError && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label htmlFor="sports-username" className="block text-xs font-semibold text-slate-700 dark:text-dark-text mb-1">
                  Öğrenci Numarası / Kullanıcı Adı
                </label>
                <input
                  id="sports-username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="Örn: 202111001/c2111001"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2 text-base sm:text-xs rounded-xl border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[44px] sm:min-h-0"
                />
              </div>

              <div>
                <label htmlFor="sports-password" className="block text-xs font-semibold text-slate-700 dark:text-dark-text mb-1">
                  Şifre
                </label>
                <input
                  id="sports-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Randevu sistemi şifreniz"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-base sm:text-xs rounded-xl border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[44px] sm:min-h-0"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full mt-2 py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50 min-h-[44px]"
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
                <div className="w-7 h-7 rounded-full bg-purple-600/20 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-xs shrink-0">
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
                disabled={bookingSeansId !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-dark-subtext hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-white dark:hover:bg-dark-border transition min-h-[36px] disabled:opacity-50"
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
                  disabled={isLoadingSlots || bookingSeansId !== null}
                  className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-dark-border text-slate-600 dark:text-dark-subtext hover:bg-white dark:hover:bg-dark-border transition disabled:opacity-50 min-h-[36px]"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingSlots ? 'animate-spin' : ''}`} />
                  <span>Yenile</span>
                </button>
              </div>

              {/* Quick Date Pills & Dropdowns */}
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
                    disabled={bookingSeansId !== null}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition min-h-[36px] ${
                      selectedDate === btn.date
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white dark:bg-dark-card text-slate-700 dark:text-dark-text border border-slate-200 dark:border-dark-border hover:bg-slate-100 dark:hover:bg-slate-800'
                    } disabled:opacity-50`}
                  >
                    {btn.label}
                  </button>
                ))}

                <div className="ml-auto flex items-center gap-1 flex-wrap" aria-label="Tarih seçimi">
                  <select
                    aria-label="Gün"
                    value={selectedDay}
                    disabled={bookingSeansId !== null}
                    onChange={(e) => handleDatePartChange('day', e.target.value)}
                    className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-800 dark:text-dark-text focus:outline-none focus:ring-1 focus:ring-purple-500 min-h-[36px]"
                  >
                    {Array.from({ length: daysInSelectedMonth }, (_, index) => index + 1).map(day => (
                      <option key={day} value={day}>{String(day).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Ay"
                    value={selectedMonth}
                    disabled={bookingSeansId !== null}
                    onChange={(e) => handleDatePartChange('month', e.target.value)}
                    className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-800 dark:text-dark-text focus:outline-none focus:ring-1 focus:ring-purple-500 min-h-[36px]"
                  >
                    {TURKISH_MONTHS.map((month, index) => (
                      <option key={month} value={index + 1}>{month}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Yıl"
                    value={selectedYear}
                    disabled={bookingSeansId !== null}
                    onChange={(e) => handleDatePartChange('year', e.target.value)}
                    className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-800 dark:text-dark-text focus:outline-none focus:ring-1 focus:ring-purple-500 min-h-[36px]"
                  >
                    {selectableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Slots List Header */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-dark-subtext px-1">
              <span>Fitness Seansları (Merkez Kampüs Spor Salonu)</span>
              <span>{slots.length} Seans Listelendi</span>
            </div>

            {/* Loading Indicator */}
            {isLoadingSlots && (
              <div role="status" aria-live="polite" className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-dark-subtext">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600 dark:text-purple-400" />
                <span className="text-xs">Seans bilgileri randevu sisteminden alınıyor...</span>
              </div>
            )}

            {/* Error Indicator with Retry */}
            {slotsError && !isLoadingSlots && (
              <div role="alert" className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Seanslar Alınamadı</p>
                    <p>{slotsError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => loadSlots(selectedDate)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium transition flex items-center gap-1.5 min-h-[36px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tekrar Dene</span>
                </button>
              </div>
            )}

            {/* Empty state */}
            {!isLoadingSlots && !slotsError && slots.length === 0 && (
              <div role="status" className="py-10 text-center space-y-2 rounded-xl border border-dashed border-slate-200 dark:border-dark-border p-6 text-slate-500 dark:text-dark-subtext">
                <Calendar className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600 opacity-60" />
                <p className="text-xs font-medium">Bu tarih ({formatDateToTurkish(selectedDate)}) için kayıtlı seans bulunamadı.</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Lütfen başka bir gün veya hafta içi bir tarih seçmeyi deneyin.</p>
              </div>
            )}

            {/* Slots Cards */}
            {!isLoadingSlots && slots.length > 0 && (
              <div className="space-y-3" aria-busy={isLoadingSlots}>
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
                              <div
                                role="progressbar"
                                aria-valuenow={slot.occupied ?? 0}
                                aria-valuemin={0}
                                aria-valuemax={slot.capacity || 25}
                                aria-label={`${slot.time_slot} doluluk oranı: ${slot.occupied ?? 0} / ${slot.capacity || 25}`}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
                              >
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
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-3 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800 min-h-[36px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                Randevu Alındı
                              </span>

                              {!bookingState.addedToTimetable ? (
                                <button
                                  onClick={() => handleAddToTimetable(slot)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition min-h-[36px]"
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
                              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-dark-card text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-dark-border min-h-[44px]"
                            >
                              Kontenjan Dolu
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBook(slot)}
                              disabled={bookingSeansId !== null}
                              className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition flex items-center gap-1.5 min-h-[44px] ${
                                clash
                                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                  : 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
                              } disabled:opacity-50`}
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
      <div className="p-3.5 sm:px-6 bg-slate-50 dark:bg-dark-card border-t border-slate-200 dark:border-dark-border flex items-center justify-between text-xs text-slate-500 dark:text-dark-subtext shrink-0">
        <div className="flex items-center gap-1.5 text-[11px]">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Tesis randevuları haftalık olarak okul tarafından güncellenir.</span>
        </div>

        <button
          onClick={() => setSportsModalOpen(false)}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-700 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition min-h-[36px]"
        >
          Kapat
        </button>
      </div>

    </dialog>
  );
}
