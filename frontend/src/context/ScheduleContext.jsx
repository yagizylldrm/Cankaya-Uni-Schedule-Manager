import React, { createContext, useContext, useState, useEffect } from 'react';

const ScheduleContext = createContext(null);

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
    setBasket(prev => {
      const next = { ...prev };
      delete next[courseCode];
      return next;
    });
  };

  const toggleSectionSelection = (courseCode, sectionNo) => {
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

  // 6. Generated Combinations State
  const [combinations, setCombinations] = useState([]);
  const [currentComboIndex, setCurrentComboIndex] = useState(0);
  const [conflictsInfo, setConflictsInfo] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
      setCombinations,
      currentComboIndex,
      setCurrentComboIndex,
      conflictsInfo,
      setConflictsInfo,
      isGenerating,
      setIsGenerating,
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
