// Comprehensive multi-department and schedule testing against live FastAPI backend
const BASE_URL = 'http://127.0.0.1:8000';

async function post(endpoint, data) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function get(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function prepareCourseSelection(codes) {
  const selection = {};
  for (const code of codes) {
    const detail = await get(`/api/courses/${code}`);
    if (detail.sections && detail.sections.length > 0) {
      selection[code] = detail.sections.map(s => String(s.section_no));
    } else {
      selection[code] = [];
    }
  }
  return selection;
}

const scenarios = [
  {
    name: '1. Bilgisayar Mühendisliği (CENG) - Temel Ders Paketi',
    dept: 'CENG',
    codes: ['CENG105', 'CENG111', 'ENG121'],
    preferences: {}
  },
  {
    name: '2. Bilgisayar Mühendisliği (CENG) - Staj (Untimed) + Teori',
    dept: 'CENG',
    codes: ['CENG111', 'CENG200', 'ENG121'],
    preferences: {}
  },
  {
    name: '3. Endüstri Mühendisliği (IE) - Çoklu Şube',
    dept: 'IE',
    codes: ['IE117', 'IE227', 'ENG121'],
    preferences: {}
  },
  {
    name: '4. Elektrik-Elektronik Mühendisliği (EE) - Laboratuvar ve Teori',
    dept: 'EE',
    codes: ['EE101', 'EE103', 'ENG121'],
    preferences: {}
  },
  {
    name: '5. Makine Mühendisliği (ME) - Dönem Paketi',
    dept: 'ME',
    codes: ['ME113', 'ME198', 'CHEM103'],
    preferences: {}
  },
  {
    name: '6. Yazılım Mühendisliği (SENG) - Algoritma & Programlama',
    dept: 'SENG',
    codes: ['SENG101', 'CENG111', 'ENG121'],
    preferences: {}
  },
  {
    name: '7. Mimarlık (ARCH) - Tasarım Stüdyosu & Teori',
    dept: 'ARCH',
    codes: ['ARCH101', 'ARCH103'],
    preferences: {}
  },
  {
    name: '8. İşletme / Yönetim (MAN) - Yönetim ve Hukuk',
    dept: 'MAN',
    codes: ['MAN101', 'MAN201', 'ENG121'],
    preferences: {}
  },
  {
    name: '9. İnşaat Mühendisliği (CE) - Temel Mühendislik',
    dept: 'CE',
    codes: ['CE115', 'CE241', 'ENG121'],
    preferences: {}
  },
  {
    name: '10. Çift Anadal (CENG + MATH Double Major)',
    dept: 'CENG',
    codes: ['CENG111', 'MATH111', 'ENG121'],
    preferences: {}
  },
  {
    name: '11. Özel Etkinlik / Mola (Custom Block) Entegrasyonu',
    dept: 'CENG',
    codes: ['CENG105', 'ENG121'],
    preferences: {},
    custom_blocks: {
      'Pazartesi:12:00 - 12:50': {
        day: 'Pazartesi',
        time_slot: '12:00 - 12:50',
        title: 'Öğle Yemeği & Dinlenme',
        color: 'amber'
      }
    }
  },
  {
    name: '12. Filtre Tercihleri (Morning Only / Sadece Sabah)',
    dept: 'IE',
    codes: ['IE117', 'ENG121'],
    preferences: {
      morning_only: true
    }
  }
];

async function run() {
  console.log('====================================================');
  console.log('Çankaya Uni Schedule Manager - Çoklu Bölüm Testleri');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  for (const s of scenarios) {
    process.stdout.write(`Testing: ${s.name} ... `);
    try {
      const selected_courses = await prepareCourseSelection(s.codes);
      const res = await post('/api/combinations', {
        selected_courses,
        preferences: s.preferences || {},
        custom_blocks: s.custom_blocks || {}
      });

      if (res.combinations && res.count > 0) {
        const top = res.combinations[0];
        console.log(`✅ BAŞARILI: ${res.count} kombinasyon oluşturuldu.`);
        console.log(`   İlk alternatif: ${top.days_count} gün, ${top.total_credits} kredi, ${top.sections.length} şube`);
        passed++;
      } else if (res.combinations && res.count === 0 && res.conflicts_info) {
        console.log(`⚠️ BİLGİ/ÇAKIŞMA YÖNETİMİ: 0 kombinasyon (${res.conflicts_info.slice(0, 60)}...)`);
        passed++;
      } else {
        console.log(`❌ Beklenmeyen yanıt formatı:`, res);
        failed++;
      }
    } catch (err) {
      console.log(`❌ HATA: ${err.message}`);
      failed++;
    }
  }

  console.log('\n--- Müfredat ve Transkript İlerlemesi Testleri ---');
  const curriculumDepts = ['CENG', 'IE', 'EE', 'ME', 'SENG', 'ARCH', 'LAW', 'MAN', 'MATH', 'CE'];
  for (const dept of curriculumDepts) {
    process.stdout.write(`Curriculum Progress for ${dept} ... `);
    try {
      const res = await post('/api/curriculum/progress', {
        primary_dept: dept,
        passed_courses: {
          'ENG121': { grade: 'AA', status: 'PASSED' },
          'TURK101': { grade: 'BA', status: 'PASSED' }
        }
      });

      if (res.curriculum_name) {
        const totalReq = res.compulsory_total + (res.tech_slots_total || 0) + (res.social_slots_total || 0);
        console.log(`✅ BAŞARILI: ${res.curriculum_name} (${res.compulsory_passed} tamamlandı / ${totalReq} toplam ders gereksinimi, ${res.total_credits} mezuniyet kredisi)`);
        passed++;
      } else {
        console.log(`ℹ️ Müfredat tanımlı değil (${dept})`);
      }
    } catch (err) {
      console.log(`❌ HATA: ${err.message}`);
      failed++;
    }
  }

  console.log('\n====================================================');
  console.log(`Sonuç: ${passed} Başarılı, ${failed} Hatalı`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

run();
