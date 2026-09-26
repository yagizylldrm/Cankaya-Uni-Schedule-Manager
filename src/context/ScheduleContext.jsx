import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { generateCombinations, fetchCourseDetail } from '../services/api';
import { inputSignature, parseTimeRange, validatePlan } from '../utils/plan';
import { refreshBasketMetadata, refreshCombinationInstructors } from '../utils/courseCatalog';
import { ScheduleContext } from './scheduleContextValue';
import { emptyDraft, readDrafts, DRAFTS_KEY, validateDraftName } from '../utils/drafts';



const STORAGE_KEYS = {
  THEME: 'cankaya_theme',
  PROFILE: 'cankaya_student_profile',
  BASKET: 'cankaya_course_basket',
  CUSTOM_BLOCKS: 'cankaya_custom_blocks',
  PREFERENCES: 'cankaya_preferences'
};

function scheduleContentSignature(basket, customBlocks, profile) {
  const selected = Object.fromEntries(Object.entries(basket).map(([code, course]) =>
    [code, [...(course.selectedSections || [])].sort()]));
  return inputSignature(selected, {}, customBlocks, profile);
}

export function ScheduleProvider({ children }) {
  const [draftStore, setDraftStore] = useState(readDrafts);
  const initialDraft = useRef(draftStore.drafts.find(d => d.id === draftStore.activeId).plan).current;
  // 1. Theme State (default: 'cankaya')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'cankaya';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'cankaya' ? 'dark' : 'cankaya'));
  };

  const [courseColors, setCourseColors] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cankaya_course_colors') || '{}');
    } catch {
      return {};
    }
  });

  const updateCourseColor = (code, paletteIndex) => {
    setCourseColors(prev => ({ ...prev, [code]: paletteIndex }));
  };

  useEffect(() => {
    localStorage.setItem('cankaya_course_colors', JSON.stringify(courseColors));
  }, [courseColors]);

  // 2. Student Profile State
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return saved ? (() => {
        const parsed = JSON.parse(saved);
        return { hidePassedCourses: Object.keys(parsed.passedCourses || {}).length > 0, ...parsed,
          ...initialDraft.program };
      })() : {
        ...initialDraft.program,
        passedCourses: {},
        failedCourses: {},
        hidePassedCourses: false
      };
    } catch {
      return {
        ...initialDraft.program,
        passedCourses: {},
        failedCourses: {},
        hidePassedCourses: false
      };
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  }, [profile]);

  const updateProfile = (updates) => {
    setProfile(prev => ({ ...prev, ...updates }));
  };

  const addPassedCourse = (code, grade = 'CC', name = '') => {
    const norm = code.trim().toUpperCase().replace(/\s+/g, '');
    setProfile(prev => ({
      ...prev,
      passedCourses: {
        ...prev.passedCourses,
        [norm]: { code: norm, grade: grade.toUpperCase(), name: name || norm }
      }
    }));
  };

  const removePassedCourse = (code) => {
    const norm = code.trim().toUpperCase().replace(/\s+/g, '');
    setProfile(prev => {
      const next = { ...prev.passedCourses };
      delete next[norm];
      return { ...prev, passedCourses: next };
    });
  };

  // 3. Course Basket State
  const [basket, setBasket] = useState(initialDraft.basket);
  const basketTotalCredits = Object.values(basket).reduce((sum, course) => sum + (course.credit || 0), 0);
  const basketTotalEcts = Object.values(basket).reduce((sum, course) => sum + (course.ects || 0), 0);
  const basketRef = useRef(basket);
  basketRef.current = basket;
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const basketCodes = JSON.stringify(Object.keys(basket).sort());

  useEffect(() => {
    let active = true;
    const codes = JSON.parse(basketCodes);
    if (!codes.length) return;
    Promise.allSettled(codes.map(code => fetchCourseDetail(code, {
      primary_dept: profile.primaryDept, secondary_dept: profile.secondaryDept,
      secondary_type: profile.secondaryType,
    }))).then(results => {
      if (!active) return;
      const details = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      setBasket(current => refreshBasketMetadata(current, details));
      setCombinations(current => refreshCombinationInstructors(current, details));
      for (const result of results) {
        if (result.status === 'rejected') console.error('Ders bilgisi güncellenemedi:', result.reason);
      }
    });
    return () => { active = false; };
  }, [basketCodes, profile.primaryDept, profile.secondaryDept, profile.secondaryType, catalogRefresh]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BASKET, JSON.stringify(basket));
  }, [basket]);

  const addToBasket = (courseDetail, instructor = '') => {
    const code = courseDetail.code;
    if (basketRef.current[code]) return;
    const allSecNos = courseDetail.sections ? courseDetail.sections.map(s => String(s.section_no)) : [];
    const instructorSecNos = instructor ? (courseDetail.sections || [])
      .filter(s => s.instructor === instructor).map(s => String(s.section_no)) : [];
    const nextCourse = {
      code: courseDetail.code,
      name: courseDetail.name,
      dept_code: courseDetail.dept_code,
      credit: courseDetail.credit,
      ects: courseDetail.ects,
      ...(courseDetail.untimed === true ? { untimed: true } : {}),
      type: courseDetail.type,
      type_label: courseDetail.type_label,
      selectedSections: instructorSecNos.length ? instructorSecNos : allSecNos,
      allSections: courseDetail.sections || []
    };
    // Two detail requests can finish before React renders the first addition.
    // Reserve the code immediately so a repeated add cannot start a new spinner.
    basketRef.current = { ...basketRef.current, [code]: nextCourse };
    clearGeneratedSchedule();
    setBasket(prev => prev[code] ? prev : { ...prev, [code]: nextCourse });
  };

  const removeFromBasket = (courseCode) => {
    if (!basket[courseCode]) return;
    clearGeneratedSchedule(Object.keys(basket).length > 1);
    setBasket(prev => {
      const next = { ...prev };
      delete next[courseCode];
      return next;
    });
  };

  const toggleSectionSelection = (courseCode, sectionNo) => {
    if (!basket[courseCode]) return;
    clearGeneratedSchedule();
    const secStr = String(sectionNo);
    setBasket(prev => {
      const c = prev[courseCode];
      if (!c) return prev;
      const isSelected = c.selectedSections.includes(secStr);
      const newSelected = isSelected
        ? c.selectedSections.filter(s => s !== secStr)
        : [...c.selectedSections, secStr];
      return {
        ...prev,
        [courseCode]: { ...c, selectedSections: newSelected }
      };
    });
  };

  const selectCourseInstructor = (courseCode, instructor) => {
    const course = basket[courseCode];
    if (!course) return;
    const sections = course.allSections || [];
    const matching = instructor ? sections.filter(s => s.instructor === instructor) : sections;
    if (!matching.length) return;
    const selectedSections = matching.map(s => String(s.section_no));
    if (selectedSections.length === course.selectedSections.length &&
        selectedSections.every(number => course.selectedSections.includes(number))) return;
    clearGeneratedSchedule();
    setBasket(prev => ({ ...prev, [courseCode]: { ...prev[courseCode], selectedSections } }));
  };

  const updateCourseCredit = (courseCode, credit, ects) => {
    setBasket(prev => {
      const c = prev[courseCode];
      if (!c) return prev;
      return {
        ...prev,
        [courseCode]: { ...c, credit: Number(credit), ects: Number(ects) }
      };
    });
  };

  // 4. Custom Timetable Blocks (Lunch, Gym, Study, etc.)
  const [customBlocks, setCustomBlocks] = useState(initialDraft.customBlocks);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_BLOCKS, JSON.stringify(customBlocks));
  }, [customBlocks]);

  const setCustomBlock = (day, timeSlot, title, note = '', color = 'amber') => {
    const key = `${day}:${timeSlot}`;
    setCustomBlocks(prev => ({
      ...prev,
      [key]: { day, time_slot: timeSlot, title, note, color }
    }));
  };

  const deleteCustomBlock = (day, timeSlot) => {
    const key = `${day}:${timeSlot}`;
    setCustomBlocks(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
  const clearCustomBlocks = () => setCustomBlocks({});

  // 5. Schedule Preferences
  const [preferences, setPreferences] = useState(initialDraft.preferences);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
  }, [preferences]);

  const updatePreferences = (updates) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  };

  // Keep only the chosen combination across reloads, not the entire search result.
  const [combinations, setCombinations] = useState(() => initialDraft.selectedCombination ? [initialDraft.selectedCombination] : []);
  const [currentComboIndex, setCurrentComboIndex] = useState(0);
  const [comboSort, setComboSortState] = useState('default');
  const sortedCombinations = useMemo(() => {
    if (!combinations.length || comboSort === 'default') return combinations;
    const bounds = combination => {
      const ranges = (combination.sections || []).flatMap(section => (section.slots || [])
        .map(slot => parseTimeRange(slot.time_slot)).filter(Boolean));
      return {
        start: ranges.length ? Math.min(...ranges.map(range => range[0])) : -Infinity,
        end: ranges.length ? Math.max(...ranges.map(range => range[1])) : Infinity,
      };
    };
    const copy = [...combinations];
    if (comboSort === 'fewest_days') copy.sort((a, b) => (a.days_count || 0) - (b.days_count || 0));
    if (comboSort === 'latest_start') copy.sort((a, b) => bounds(b).start - bounds(a).start);
    if (comboSort === 'earliest_end') copy.sort((a, b) => bounds(a).end - bounds(b).end);
    return copy;
  }, [combinations, comboSort]);
  const setComboSort = useCallback(nextSort => {
    const selected = sortedCombinations[currentComboIndex] || null;
    const bounds = combination => {
      const ranges = (combination.sections || []).flatMap(section => (section.slots || [])
        .map(slot => parseTimeRange(slot.time_slot)).filter(Boolean));
      return {
        start: ranges.length ? Math.min(...ranges.map(range => range[0])) : -Infinity,
        end: ranges.length ? Math.max(...ranges.map(range => range[1])) : Infinity,
      };
    };
    const next = [...combinations];
    if (nextSort === 'fewest_days') next.sort((a, b) => (a.days_count || 0) - (b.days_count || 0));
    if (nextSort === 'latest_start') next.sort((a, b) => bounds(b).start - bounds(a).start);
    if (nextSort === 'earliest_end') next.sort((a, b) => bounds(a).end - bounds(b).end);
    setCurrentComboIndex(selected ? Math.max(0, next.indexOf(selected)) : 0);
    setComboSortState(nextSort);
  }, [combinations, sortedCombinations, currentComboIndex]);
  const [conflictsInfo, setConflictsInfo] = useState(null);
  const [conflictDetails, setConflictDetails] = useState([]);
  const [resultSignature, setResultSignature] = useState(() => initialDraft.selectedCombination ? inputSignature(
    initialDraft.basket, initialDraft.preferences, initialDraft.customBlocks, initialDraft.program) : null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [semester, setSemester] = useState(initialDraft.semester);
  const [restoredPlan, setRestoredPlan] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [notice, setNotice] = useState(null);
  const notify = useCallback((message, kind = 'error') => setNotice({ message, kind, id: Date.now() }), []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const requestId = useRef(0);
  const signature = inputSignature(basket, preferences, customBlocks, profile);
  const previousSchedulingSignature = useRef(signature);
  const successfulContentSignature = useRef(initialDraft.selectedCombination ? scheduleContentSignature(
    initialDraft.basket, initialDraft.customBlocks, initialDraft.program) : null);
  const isScheduleStale = Boolean(combinations.length && resultSignature !== signature);

  const selectedCombination = sortedCombinations[currentComboIndex] || null;
  const totalCombos = sortedCombinations.length;
  const canExport = Boolean(selectedCombination && !isGenerating && !isScheduleStale);

  // Each plan is saved automatically; transcript and theme belong to the student, not a draft.
  useEffect(() => {
    const plan = { version: 1, basket, preferences, customBlocks, semester,
      program: { primaryDept: profile.primaryDept, secondaryDept: profile.secondaryDept, secondaryType: profile.secondaryType },
      selectedCombination: !isScheduleStale && !isGenerating ? selectedCombination : null };
    const next = { ...draftStore, drafts: draftStore.drafts.map(d => d.id === draftStore.activeId ? { ...d, plan } : d) };
    try {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
      setDraftStore(next);
      setStorageError('');
    } catch { setStorageError('Taslaklar bu tarayıcıya kaydedilemedi.'); }
    // Store metadata is written by draft actions; avoid a loop from setDraftStore.
  }, [basket, preferences, customBlocks, semester, profile.primaryDept, profile.secondaryDept,
    profile.secondaryType, selectedCombination, isScheduleStale, isGenerating, draftStore.activeId]);

  const currentDraftPlan = () => ({ version: 1, basket, preferences, customBlocks, semester,
    program: { primaryDept: profile.primaryDept, secondaryDept: profile.secondaryDept, secondaryType: profile.secondaryType },
    selectedCombination: canExport ? selectedCombination : null });

  const saveDraftStore = next => {
    setDraftStore(next);
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(next)); setStorageError(''); }
    catch { setStorageError('Taslaklar bu tarayıcıya kaydedilemedi.'); }
  };

  const openDraft = id => {
    const target = draftStore.drafts.find(d => d.id === id);
    if (!target || id === draftStore.activeId) return;
    const next = { ...draftStore, activeId: id, drafts: draftStore.drafts.map(d =>
      d.id === draftStore.activeId ? { ...d, plan: currentDraftPlan() } : d) };
    saveDraftStore(next);
    const plan = target.plan;
    ++requestId.current;
    previousSchedulingSignature.current = inputSignature(plan.basket, plan.preferences, plan.customBlocks, plan.program);
    successfulContentSignature.current = plan.selectedCombination ? scheduleContentSignature(
      plan.basket, plan.customBlocks, plan.program) : null;
    setIsGenerating(false);
    setBasket(plan.basket);
    setPreferences(plan.preferences);
    setCustomBlocks(plan.customBlocks);
    setSemester(plan.semester);
    setProfile(prev => ({ ...prev, ...plan.program }));
    setCombinations(plan.selectedCombination ? [plan.selectedCombination] : []);
    setCurrentComboIndex(0);
    setResultSignature(plan.selectedCombination ? inputSignature(plan.basket, plan.preferences, plan.customBlocks, plan.program) : null);
    setConflictsInfo(null);
    setConflictDetails([]);
    setGenerationError('');
    setRestoredPlan(Boolean(plan.selectedCombination));
  };

  const createDraft = (name, duplicate = false) => {
    if (draftStore.drafts.length >= 10) throw new Error('En fazla 10 plan oluşturabilirsiniz.');
    const clean = validateDraftName(name, draftStore.drafts);
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const plan = duplicate ? currentDraftPlan() : emptyDraft({ primaryDept: profile.primaryDept,
      secondaryDept: profile.secondaryDept, secondaryType: profile.secondaryType });
    const next = { ...draftStore, activeId: id, drafts: [...draftStore.drafts.map(d =>
      d.id === draftStore.activeId ? { ...d, plan: currentDraftPlan() } : d), { id, name: clean, plan }] };
    saveDraftStore(next);
    ++requestId.current;
    previousSchedulingSignature.current = inputSignature(plan.basket, plan.preferences, plan.customBlocks, plan.program);
    successfulContentSignature.current = plan.selectedCombination ? scheduleContentSignature(
      plan.basket, plan.customBlocks, plan.program) : null;
    setIsGenerating(false);
    setBasket(plan.basket);
    setPreferences(plan.preferences);
    setCustomBlocks(plan.customBlocks);
    setSemester(plan.semester);
    setCombinations(plan.selectedCombination ? [plan.selectedCombination] : []);
    setCurrentComboIndex(0);
    setResultSignature(plan.selectedCombination ? inputSignature(plan.basket, plan.preferences, plan.customBlocks, plan.program) : null);
    setConflictsInfo(null);
    setConflictDetails([]);
    setGenerationError('');
    setRestoredPlan(Boolean(plan.selectedCombination));
    return id;
  };

  const renameDraft = (id, name) => {
    const clean = validateDraftName(name, draftStore.drafts, id);
    saveDraftStore({ ...draftStore, drafts: draftStore.drafts.map(d => ({ ...d,
      ...(d.id === draftStore.activeId ? { plan: currentDraftPlan() } : {}),
      ...(d.id === id ? { name: clean } : {}) })) });
  };

  const deleteDraft = id => {
    if (draftStore.drafts.length === 1) throw new Error('Son plan silinemez.');
    const next = { ...draftStore, drafts: draftStore.drafts.filter(d => d.id !== id).map(d =>
      d.id === draftStore.activeId ? { ...d, plan: currentDraftPlan() } : d) };
    if (id === draftStore.activeId) {
      const target = next.drafts[0];
      next.activeId = target.id;
      openDraft(target.id);
    }
    saveDraftStore(next);
  };

  useEffect(() => {
    // Do not associate an old result with the newly edited inputs.
    if (isScheduleStale) return;
    try {
      if (!selectedCombination) localStorage.removeItem('cankaya_selected_schedule');
      else localStorage.setItem('cankaya_selected_schedule', JSON.stringify({ signature: resultSignature,
        plan: { version: 1, basket, preferences, customBlocks, selectedCombination, semester,
          program: { primaryDept: profile.primaryDept, secondaryDept: profile.secondaryDept, secondaryType: profile.secondaryType } } }));
      setStorageError('');
    } catch { setStorageError('Program bu tarayıcıya kaydedilemedi. JSON olarak indirebilirsiniz.'); }
  }, [selectedCombination, resultSignature, isScheduleStale, basket, preferences, customBlocks, profile, semester]);

  const clearGeneratedSchedule = (hasCourses = true) => {
    // A response for the previous basket must not restore removed courses.
    ++requestId.current;
    // Keep the previous timetable in place until its replacement arrives.
    // Its signature becomes stale as soon as the course selection changes.
    if (!hasCourses) {
      setCombinations([]);
      setCurrentComboIndex(0);
      setResultSignature(null);
    }
    setConflictsInfo(null);
    setConflictDetails([]);
    setGenerationError('');
    setIsGenerating(hasCourses);
    setRestoredPlan(false);
  };

  const generateSchedule = useCallback(async (overrides = {}) => {
    const id = ++requestId.current;
    const nextPreferences = overrides.preferences || preferences;
    const nextBlocks = overrides.customBlocks || customBlocks;
    if (overrides.preferences) setPreferences(nextPreferences);
    if (overrides.customBlocks) setCustomBlocks(nextBlocks);
    const requestedSignature = inputSignature(basket, nextPreferences, nextBlocks, profile);
    const requestedContentSignature = scheduleContentSignature(basket, nextBlocks, profile);
    setGenerationError('');
    setIsGenerating(true);
    try {
      const selected = Object.fromEntries(Object.entries(basket).map(([code, c]) => [code, c.selectedSections || []]));
      const res = await generateCombinations(selected, nextPreferences, nextBlocks);
      if (id !== requestId.current) return;
      if (res.combinations?.length) {
        successfulContentSignature.current = requestedContentSignature;
        setCombinations(res.combinations);
        setCurrentComboIndex(0);
        setResultSignature(requestedSignature);
        setConflictsInfo(null);
      } else {
        const preserveCurrent = successfulContentSignature.current === requestedContentSignature;
        if (!preserveCurrent) {
          successfulContentSignature.current = null;
          setCombinations([]);
          setCurrentComboIndex(0);
          setResultSignature(null);
        }
        const message = res.conflicts_info || 'Çakışmasız program bulunamadı.';
        setConflictsInfo(preserveCurrent ? `Yeni tercihlere uygun program bulunamadı. Mevcut program korunuyor. ${message}` : message);
      }
      setConflictDetails(res.conflict_details || []);
      setRestoredPlan(false);
    } catch (err) {
      if (id === requestId.current) setGenerationError(err.message);
    } finally {
      if (id === requestId.current) setIsGenerating(false);
    }
  }, [basket, preferences, customBlocks, profile]);

  useEffect(() => {
    if (previousSchedulingSignature.current === signature) return;
    previousSchedulingSignature.current = signature;
    if (!Object.keys(basket).length) {
      setCombinations([]);
      setCurrentComboIndex(0);
      setResultSignature(null);
      setConflictsInfo(null);
      setConflictDetails([]);
      setGenerationError('');
      setIsGenerating(false);
      return;
    }
    const timer = setTimeout(() => {
      generateSchedule();
    }, 60);
    return () => clearTimeout(timer);


  // A metadata-only rerender must not cancel a pending request for this signature.
  }, [signature]);

  const restorePlan = raw => {
    const plan = validatePlan(raw);
    ++requestId.current; // Ignore responses started before the import.
    setIsGenerating(false);
    // Import restores the exact saved alternative rather than generating a new one.
    previousSchedulingSignature.current = inputSignature(plan.basket, plan.preferences, plan.customBlocks, plan.program);
    successfulContentSignature.current = plan.selectedCombination ? scheduleContentSignature(
      plan.basket, plan.customBlocks, plan.program) : null;
    setBasket(plan.basket);
    setCatalogRefresh(value => value + 1);
    setPreferences(plan.preferences);
    setCustomBlocks(plan.customBlocks);
    setProfile(prev => ({ ...prev, ...plan.program }));
    setSemester(plan.semester);
    setCombinations(plan.selectedCombination ? [plan.selectedCombination] : []);
    setCurrentComboIndex(0);
    setResultSignature(plan.selectedCombination ? inputSignature(plan.basket, plan.preferences, plan.customBlocks, plan.program) : null);
    setConflictsInfo(null);
    setConflictDetails([]);
    setGenerationError('');
    setRestoredPlan(true);
  };

  // 7. Modals
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const [customBlockModalData, setCustomBlockModalData] = useState(null); // { day, timeSlot, currentBlock }
  const [courseDetailModalCode, setCourseDetailModalCode] = useState(null);

  // Helper for passed course codes string
  const passedCodesString = Object.keys(profile.passedCourses || {}).join(',');

  return (
    <ScheduleContext.Provider value={{
      theme,
      toggleTheme,
      courseColors,
      updateCourseColor,
      profile,
      updateProfile,
      addPassedCourse,
      removePassedCourse,
      passedCodesString,
      basket,
      basketTotalCredits,
      basketTotalEcts,
      addToBasket,
      removeFromBasket,
      toggleSectionSelection,
      selectCourseInstructor,
      updateCourseCredit,
      customBlocks,
      setCustomBlock,
      deleteCustomBlock,
      clearCustomBlocks,
      drafts: draftStore.drafts.map(({ id, name, plan }) => ({ id, name, courseCount: Object.keys(plan.basket).length })),
      activeDraftId: draftStore.activeId,
      createDraft,
      openDraft,
      renameDraft,
      deleteDraft,
      preferences,
      updatePreferences,
      combinations,
      sortedCombinations,
      comboSort,
      setComboSort,
      totalCombos,
      currentComboIndex,
      setCurrentComboIndex,
      conflictsInfo,
      isGenerating,
      generateSchedule,
      generationError,
      conflictDetails,
      isScheduleStale,
      selectedCombination,
      canExport,
      semester,
      setSemester,
      restorePlan,
      restoredPlan,
      storageError,
      notice,
      notify,
      dismissNotice: () => setNotice(null),
      transcriptModalOpen,
      setTranscriptModalOpen,
      customBlockModalData,
      setCustomBlockModalData,
      courseDetailModalCode,
      setCourseDetailModalCode
    }}>
      {children}
    </ScheduleContext.Provider>
  );
}
