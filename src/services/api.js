/**
 * API Service for communication with FastAPI serverless backend.
 */
import { uniqueTimetableCombinations } from '../utils/combinations.js';

const BASE_URL = '/api';

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('API bağlantısı kurulamadı');
  return res.json();
}

export async function fetchDepartments() {
  const res = await fetch(`${BASE_URL}/departments`);
  if (!res.ok) throw new Error('Bölümler listelenemedi');
  return res.json();
}

export async function fetchCourses({
  query = '',
  dept = '',
  type = 'TÜMÜ',
  primary_dept = 'CENG',
  secondary_dept = 'YOK',
  secondary_type = 'YOK',
  only_eligible = false,
  hide_passed = false,
  include_outside_curriculum = false,
  passed_codes = ''
}) {
  const params = new URLSearchParams();
  if (query) params.append('query', query);
  if (dept && dept !== 'TÜMÜ') params.append('dept', dept);
  if (type && type !== 'TÜMÜ') params.append('type', type);
  if (primary_dept) params.append('primary_dept', primary_dept);
  if (secondary_dept) params.append('secondary_dept', secondary_dept);
  if (secondary_type) params.append('secondary_type', secondary_type);
  if (only_eligible) params.append('only_eligible', 'true');
  if (hide_passed) params.append('hide_passed', 'true');
  if (include_outside_curriculum) params.append('include_outside_curriculum', 'true');
  if (passed_codes) params.append('passed_codes', passed_codes);

  const res = await fetch(`${BASE_URL}/courses?${params.toString()}`);
  if (!res.ok) throw new Error('Dersler alınırken hata oluştu');
  return res.json();
}

export async function fetchCourseDetail(code, {
  primary_dept = 'CENG',
  secondary_dept = 'YOK',
  secondary_type = 'YOK',
  passed_codes = ''
} = {}) {
  const params = new URLSearchParams();
  if (primary_dept) params.append('primary_dept', primary_dept);
  if (secondary_dept) params.append('secondary_dept', secondary_dept);
  if (secondary_type) params.append('secondary_type', secondary_type);
  if (passed_codes) params.append('passed_codes', passed_codes);

  const res = await fetch(`${BASE_URL}/courses/${encodeURIComponent(code)}?${params.toString()}`);
  if (!res.ok) throw new Error(`Ders detayı alınamadı: ${code}`);
  return res.json();
}

export async function generateCombinations(selectedCourses, preferences = {}, customBlocks = {}) {
  const res = await fetch(`${BASE_URL}/combinations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selected_courses: selectedCourses,
      preferences,
      custom_blocks: customBlocks,
      compact: true
    })
  });
  if (!res.ok) throw new Error('Kombinasyon üretilirken hata oluştu');
  const data = await res.json();
  let combinations = data.combinations || [];
  if (data.section_catalog) {
    const catalog = data.section_catalog;
    combinations = combinations.map(({ section_refs, ...combo }) => ({
      ...combo,
      sections: section_refs.map(([code, number]) => {
        const section = catalog[code]?.[String(number)];
        if (!section) throw new Error(`Program verisinde ${code} ${number} şubesi eksik`);
        return section;
      })
    }));
  }
  const unique = uniqueTimetableCombinations(combinations);
  const { section_catalog: _catalog, ...rest } = data;
  return { ...rest, count: unique.length, combinations: unique };
}

export async function checkPrerequisites(courseCodes, passedCourses = {}) {
  const res = await fetch(`${BASE_URL}/prerequisites/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      course_codes: courseCodes,
      passed_courses: passedCourses
    })
  });
  if (!res.ok) throw new Error('Ön koşullar kontrol edilirken hata oluştu');
  return res.json();
}

export async function parseTranscriptText(text) {
  const res = await fetch(`${BASE_URL}/transcript/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Transkript metni ayrıştırılamadı');
  }
  return res.json();
}

export async function uploadTranscriptFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE_URL}/transcript/upload`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Dosya yüklenirken hata oluştu');
  }
  return res.json();
}

export async function fetchCurriculumProgress(primaryDept, passedCourses = {}) {
  const res = await fetch(`${BASE_URL}/curriculum/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      primary_dept: primaryDept,
      passed_courses: passedCourses
    })
  });
  if (!res.ok) throw new Error('Müfredat ilerleme bilgisi alınamadı');
  return res.json();
}
