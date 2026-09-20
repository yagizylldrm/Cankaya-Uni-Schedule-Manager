import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { generateCombinations } from '../services/api';
import { inputSignature, validatePlan } from '../utils/plan';

const ScheduleContext = createContext(null);

const courseSelectionSignature = basket => JSON.stringify(Object.keys(basket).sort().map(code =>
  [code, [...(basket[code].selectedSections || [])].sort()]));

const STORAGE_KEYS = {
  THEME: 'cankaya_theme',
  PROFILE: 'cankaya_student_profile',
  BASKET: 'cankaya_course_basket',
  CUSTOM_BLOCKS: 'cankaya_custom_blocks',
  PREFERENCES: 'cankaya_preferences'
};

export function ScheduleProvider({ children }) {
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

  // 2. Student Profile State
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return saved ? JSON.parse(saved) : {
        primaryDept: 'CENG',
        secondaryType: 'YOK',
        secondaryDept: 'YOK',
        passedCourses: {},
        failedCourses: {}
      };
    } catch {
      return {
        primaryDept: 'CENG',
        secondaryType: 'YOK',
        secondaryDept: 'YOK',
        passedCourses: {},
        failedCourses: {}
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
  const [basket, setBasket] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BASKET);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BASKET, JSON.stringify(basket));
  }, [basket]);

  const addToBasket = (courseDetail) => {
    const code = courseDetail.code;
    if (basket[code]) return;
    clearGeneratedSchedule();
    const allSecNos = courseDetail.sections ? courseDetail.sections.map(s => String(s.section_no)) : [];
    setBasket(prev => {
      if (prev[code]) return prev; // Already in basket
      return {
        ...prev,
        [code]: {
          code: courseDetail.code,
          name: courseDetail.name,
          dept_code: courseDetail.dept_code,
          credit: courseDetail.credit,
          ects: courseDetail.ects,
          type: courseDetail.type,
          type_label: courseDetail.type_label,
          selectedSections: allSecNos, // All sections selected by default
          allSections: courseDetail.sections || []
        }
      };
    });
  };

  const removeFromBasket = (courseCode) => {
    if (!basket[courseCode]) return;
    clearGeneratedSchedule();
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
  const [customBlocks, setCustomBlocks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_BLOCKS);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

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

  // 5. Schedule Preferences
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      return saved ? JSON.parse(saved) : {
        free_friday: false,
        free_monday: false,
        no_morning: false
      };
    } catch {
      return {
        free_friday: false,
        free_monday: false,
        no_morning: false
      };
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
  }, [preferences]);

  const updatePreferences = (updates) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  };

  // Keep only the chosen combination across reloads, not the entire search result.
  const [savedResult] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('cankaya_selected_schedule'));
      if (!saved) return null;
      return { ...saved, plan: validatePlan(saved.plan) };
    } catch { return null; }
  });
  const [combinations, setCombinations] = useState(() => savedResult?.plan.selectedCombination ? [savedResult.plan.selectedCombination] : []);
  const [currentComboIndex, setCurrentComboIndex] = useState(0);
  const [conflictsInfo, setConflictsInfo] = useState(null);
  const [conflictDetails, setConflictDetails] = useState([]);
  const [resultSignature, setResultSignature] = useState(savedResult?.signature || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [semester, setSemester] = useState(savedResult?.plan.semester || { start: '', end: '' });
  const [restoredPlan, setRestoredPlan] = useState(false);
  const [storageError, setStorageError] = useState('');
  const requestId = useRef(0);
  const courseSelection = courseSelectionSignature(basket);
  const previousCourseSelection = useRef(courseSelection);
  const signature = inputSignature(basket, preferences, customBlocks, profile);
  const isScheduleStale = Boolean(resultSignature && resultSignature !== signature);
  const selectedCombination = combinations[currentComboIndex] || null;
  const canExport = Boolean(selectedCombination && !isScheduleStale && !isGenerating);

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

  const clearGeneratedSchedule = () => {
    // A response for the previous basket must not restore removed courses.
    ++requestId.current;
    setCombinations([]);
    setCurrentComboIndex(0);
    setResultSignature(null);
    setConflictsInfo(null);
    setConflictDetails([]);
    setGenerationError('');
    setIsGenerating(false);
    setRestoredPlan(false);
  };

  const generateSchedule = useCallback(async (overrides = {}) => {
    const id = ++requestId.current;
    const nextPreferences = overrides.preferences || preferences;
    const nextBlocks = overrides.customBlocks || customBlocks;
    if (overrides.preferences) setPreferences(nextPreferences);
    if (overrides.customBlocks) setCustomBlocks(nextBlocks);
    const requestedSignature = inputSignature(basket, nextPreferences, nextBlocks, profile);
    setGenerationError('');
    setIsGenerating(true);
    try {
      const selected = Object.fromEntries(Object.entries(basket).map(([code, c]) => [code, c.selectedSections || []]));
      const res = await generateCombinations(selected, nextPreferences, nextBlocks);
      if (id !== requestId.current) return;
      setCombinations(res.combinations || []);
      setCurrentComboIndex(0);
      setResultSignature(requestedSignature);
      setConflictsInfo(res.count === 0 ? res.conflicts_info || 'Çakışmasız program bulunamadı.' : null);
      setConflictDetails(res.conflict_details || []);
      setRestoredPlan(false);
    } catch (err) {
      if (id === requestId.current) setGenerationError(err.message);
    } finally {
      if (id === requestId.current) setIsGenerating(false);
    }
  }, [basket, preferences, customBlocks, profile]);

  useEffect(() => {
    if (previousCourseSelection.current === courseSelection) return;
    previousCourseSelection.current = courseSelection;
    if (Object.keys(basket).length) generateSchedule();
  }, [courseSelection, basket, generateSchedule]);

  const restorePlan = raw => {
    const plan = validatePlan(raw);
    ++requestId.current; // Ignore responses started before the import.
    setIsGenerating(false);
    // Import restores the exact saved alternative rather than generating a new one.
    previousCourseSelection.current = courseSelectionSignature(plan.basket);
    setBasket(plan.basket);
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
      profile,
      updateProfile,
      addPassedCourse,
      removePassedCourse,
      passedCodesString,
      basket,
      addToBasket,
      removeFromBasket,
      toggleSectionSelection,
      updateCourseCredit,
      customBlocks,
      setCustomBlock,
      deleteCustomBlock,
      preferences,
      updatePreferences,
      combinations,
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

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}
