import { test, expect } from '@playwright/test';

const mockDepartments = [
  { code: 'CENG', name: 'Bilgisayar Mühendisliği (Computer Engineering)', has_curriculum: true, curriculum_name: 'Bilgisayar Mühendisliği 2026' },
  { code: 'IE', name: 'Endüstri Mühendisliği (Industrial Engineering)', has_curriculum: true, curriculum_name: 'Endüstri Mühendisliği 2026' },
  { code: 'EE', name: 'Elektrik-Elektronik Mühendisliği (Electrical & Electronics)', has_curriculum: true, curriculum_name: 'Elektrik-Elektronik Mühendisliği 2026' },
  { code: 'ME', name: 'Makine Mühendisliği (Mechanical Engineering)', has_curriculum: true, curriculum_name: 'Makine Mühendisliği 2026' },
  { code: 'ARCH', name: 'Mimarlık (Architecture)', has_curriculum: true, curriculum_name: 'Mimarlık 2026' },
  { code: 'MATH', name: 'Matematik (Mathematics)', has_curriculum: true, curriculum_name: 'Matematik 2026' }
];

const mockCoursesByDept = {
  CENG: [
    {
      code: 'CENG111',
      name: 'Bilgisayar Programlama I',
      dept_code: 'CENG',
      credit: 4,
      ects: 5,
      type: 'ZORUNLU',
      type_label: 'Zorunlu',
      sections_count: 2,
      instructors: ['Dr. Öğr. Üyesi CENG'],
      can_take: true,
      sections: [
        {
          section_no: '1',
          instructor: 'Dr. Öğr. Üyesi CENG',
          classroom: 'LB-01',
          slots: [{ day: 'Pazartesi', time_slot: '09:00 - 09:50', classroom: 'LB-01' }]
        },
        {
          section_no: '2',
          instructor: 'Dr. Öğr. Üyesi CENG',
          classroom: 'LB-02',
          slots: [{ day: 'Salı', time_slot: '13:00 - 13:50', classroom: 'LB-02' }]
        }
      ]
    },
    {
      code: 'CENG200',
      name: 'Yaz Stajı I',
      dept_code: 'CENG',
      credit: 0,
      ects: 5,
      untimed: true,
      type: 'ZORUNLU',
      type_label: 'Zorunlu',
      sections_count: 0,
      instructors: [],
      can_take: true,
      sections: []
    }
  ],
  IE: [
    {
      code: 'IE117',
      name: 'Endüstri Mühendisliğine Giriş',
      dept_code: 'IE',
      credit: 3,
      ects: 5,
      type: 'ZORUNLU',
      type_label: 'Zorunlu',
      sections_count: 2,
      instructors: ['Prof. Dr. IE Hocası'],
      can_take: true,
      sections: [
        {
          section_no: '1',
          instructor: 'Prof. Dr. IE Hocası',
          classroom: 'IE-101',
          slots: [{ day: 'Çarşamba', time_slot: '10:00 - 10:50', classroom: 'IE-101' }]
        },
        {
          section_no: '2',
          instructor: 'Prof. Dr. IE Hocası',
          classroom: 'IE-102',
          slots: [{ day: 'Perşembe', time_slot: '14:00 - 14:50', classroom: 'IE-102' }]
        }
      ]
    },
    {
      code: 'IE227',
      name: 'Yöneylem Araştırması I',
      dept_code: 'IE',
      credit: 4,
      ects: 6,
      type: 'ZORUNLU',
      type_label: 'Zorunlu',
      sections_count: 1,
      instructors: ['Doç. Dr. IE Araştırmacı'],
      can_take: true,
      sections: [
        {
          section_no: '1',
          instructor: 'Doç. Dr. IE Araştırmacı',
          classroom: 'IE-201',
          slots: [{ day: 'Cuma', time_slot: '09:00 - 09:50', classroom: 'IE-201' }]
        }
      ]
    }
  ],
  EE: [
    {
      code: 'EE101',
      name: 'Elektrik Mühendisliğine Giriş',
      dept_code: 'EE',
      credit: 3,
      ects: 5,
      type: 'ZORUNLU',
      type_label: 'Zorunlu',
      sections_count: 1,
      instructors: ['Prof. Dr. EE Hocası'],
      can_take: true,
      sections: [
        {
          section_no: '1',
          instructor: 'Prof. Dr. EE Hocası',
          classroom: 'EE-101',
          slots: [{ day: 'Salı', time_slot: '09:00 - 09:50', classroom: 'EE-101' }]
        }
      ]
    }
  ],
  MATH: [
    {
      code: 'MATH111',
      name: 'Ayrık Matematik',
      dept_code: 'MATH',
      credit: 3,
      ects: 5,
      type: 'ZORUNLU',
      type_label: 'Zorunlu',
      sections_count: 1,
      instructors: ['Doç. Dr. Matematikçi'],
      can_take: true,
      sections: [
        {
          section_no: '1',
          instructor: 'Doç. Dr. Matematikçi',
          classroom: 'M-201',
          slots: [{ day: 'Perşembe', time_slot: '09:00 - 09:50', classroom: 'M-201' }]
        }
      ]
    }
  ]
};

async function setupDepartmentsMock(page) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/departments') {
      await route.fulfill({ json: mockDepartments });
    } else if (url.pathname.startsWith('/api/courses/')) {
      const code = url.pathname.split('/').pop();
      const all = Object.values(mockCoursesByDept).flat();
      const match = all.find(c => c.code === code);
      await route.fulfill({ json: match || {} });
    } else if (url.pathname === '/api/courses') {
      const primaryDept = url.searchParams.get('primary_dept') || 'CENG';
      const secondaryDept = url.searchParams.get('secondary_dept');
      const secondaryType = url.searchParams.get('secondary_type');

      let list = [...(mockCoursesByDept[primaryDept] || [])];
      if (secondaryType !== 'YOK' && secondaryDept && mockCoursesByDept[secondaryDept]) {
        list = [...list, ...mockCoursesByDept[secondaryDept]];
      }
      await route.fulfill({ json: list });
    } else if (url.pathname === '/api/combinations') {
      const body = route.request().postDataJSON();
      const selected = body.selected_courses || {};
      const codes = Object.keys(selected);

      if (codes.length === 0) {
        await route.fulfill({ json: { count: 0, combinations: [] } });
        return;
      }

      // Build sample combinations
      const allCourses = Object.values(mockCoursesByDept).flat();
      const activeCourses = allCourses.filter(c => codes.includes(c.code));

      const sections = activeCourses.map(c => {
        if (c.untimed) {
          return { course_code: c.code, section_no: 'SAATSIZ', classroom: 'SAATSIZ', slots: [] };
        }
        return {
          course_code: c.code,
          section_no: '1',
          classroom: c.sections[0]?.classroom || 'D-101',
          slots: c.sections[0]?.slots || []
        };
      });

      const totalCredits = activeCourses.reduce((sum, c) => sum + (c.credit || 0), 0);
      const totalEcts = activeCourses.reduce((sum, c) => sum + (c.ects || 0), 0);
      const days = new Set(sections.flatMap(s => s.slots.map(sl => sl.day))).size;

      await route.fulfill({
        json: {
          count: 1,
          combinations: [
            {
              index: 0,
              total_courses: activeCourses.length,
              total_credits: totalCredits,
              total_ects: totalEcts,
              days_count: days,
              sections
            }
          ]
        }
      });
    } else if (url.pathname === '/api/curriculum/progress') {
      const body = route.request().postDataJSON();
      const dept = body.primary_dept || 'CENG';
      const curriculumNames = {
        CENG: 'Bilgisayar Mühendisliği 2026',
        IE: 'Endüstri Mühendisliği 2026',
        EE: 'Elektrik-Elektronik Mühendisliği 2026'
      };
      await route.fulfill({
        json: {
          department: dept,
          program_name: `${dept} Lisans Programı`,
          curriculum_name: curriculumNames[dept] || `${dept} Müfredatı`,
          credit_data_available: true,
          compulsory_passed: 12,
          compulsory_total: 45,
          completed_credits: 36,
          total_credits: 145,
          tech_slots_passed: 1,
          tech_slots_total: 5,
          social_slots_passed: 1,
          social_slots_total: 2
        }
      });
    } else {
      await route.fulfill({ json: {} });
    }
  });
}

test.describe('Çoklu Bölüm ve Program Yönetimi Testleri', () => {

  test('farklı bölümler arasında geçiş yapıldığında müfredat ve ders listesi güncellenir', async ({ page }) => {
    await setupDepartmentsMock(page);
    await page.goto('/');

    // 1. Initial department is CENG
    await expect(page.locator('#primary-department')).toHaveValue('CENG');
    await expect(page.getByText('Müfredat: Bilgisayar Mühendisliği 2026')).toBeVisible();
    await expect(page.getByText('CENG111')).toBeVisible();

    // 2. Switch department to IE (Endüstri Mühendisliği)
    await page.locator('#primary-department').selectOption('IE');
    await expect(page.getByText('Müfredat: Endüstri Mühendisliği 2026')).toBeVisible();
    await expect(page.getByText('IE117')).toBeVisible();
    await expect(page.getByText('IE227')).toBeVisible();

    // 3. Switch department to EE (Elektrik-Elektronik)
    await page.locator('#primary-department').selectOption('EE');
    await expect(page.getByText('Müfredat: Elektrik-Elektronik Mühendisliği 2026')).toBeVisible();
    await expect(page.getByText('EE101')).toBeVisible();
  });

  test('IE bölümünden dersler eklenerek haftalık program ve kombinasyon başarıyla oluşturulur', async ({ page }) => {
    await setupDepartmentsMock(page);
    await page.goto('/');

    // Switch to IE
    await page.locator('#primary-department').selectOption('IE');
    await expect(page.getByText('IE117')).toBeVisible();

    // Add IE117 to basket
    const ie117Card = page.locator('div.group').filter({ hasText: 'IE117' });
    await ie117Card.getByRole('button', { name: 'Ekle' }).click();

    // Verify timetable combination rendered
    await expect(page.getByText('Seçili program')).toBeVisible();
    await expect(page.locator('[data-weekly-grid]')).toContainText('IE117');

    // Add IE227 to basket
    const ie227Card = page.locator('div.group').filter({ hasText: 'IE227' });
    await ie227Card.getByRole('button', { name: 'Ekle' }).click();

    // Both courses should be visible in the weekly grid
    await expect(page.locator('[data-weekly-grid]')).toContainText('IE117');
    await expect(page.locator('[data-weekly-grid]')).toContainText('IE227');
  });

  test('saatsiz ders (untimed internship: CENG200) eklendiğinde çakışma uyarısı vermeden programa dahil edilir', async ({ page }) => {
    await setupDepartmentsMock(page);
    await page.goto('/');

    // Add CENG111 (timed) and CENG200 (untimed)
    const ceng111Card = page.locator('div.group').filter({ hasText: 'CENG111' });
    await ceng111Card.getByRole('button', { name: 'Ekle' }).click();

    const ceng200Card = page.locator('div.group').filter({ hasText: 'CENG200' });
    await ceng200Card.getByRole('button', { name: 'Ekle' }).click();

    // Untimed course badge / info appears in CombinationBar and no conflict alert is triggered
    await expect(page.getByText('Haftalık saati olmayan dersler: CENG200. AKTS toplamına dahildir.')).toBeVisible();
    await expect(page.getByText('Uygun program bulunamadı')).toHaveCount(0);
  });

  test('çift anadal senaryosunda (CENG + MATH) her iki bölümün dersleri bir arada programlanır', async ({ page }) => {
    await setupDepartmentsMock(page);
    await page.goto('/');

    // 1. Enable Double Major (ÇAP)
    const secondaryTypeSelect = page.locator('select').nth(1);
    await secondaryTypeSelect.selectOption('CAP');

    // 2. Select MATH as secondary department
    const secondaryDeptSelect = page.locator('select').nth(2);
    await secondaryDeptSelect.selectOption('MATH');

    // 3. Courses from both departments should be displayed in search panel
    await expect(page.getByText('CENG111')).toBeVisible();
    await expect(page.getByText('MATH111')).toBeVisible();

    // 4. Add CENG111
    await page.locator('div.group').filter({ hasText: 'CENG111' }).getByRole('button', { name: 'Ekle' }).click();

    // 5. Add MATH111
    await page.locator('div.group').filter({ hasText: 'MATH111' }).getByRole('button', { name: 'Ekle' }).click();

    // 6. Timetable grid contains both departments' courses
    await expect(page.locator('[data-weekly-grid]')).toContainText('CENG111');
    await expect(page.locator('[data-weekly-grid]')).toContainText('MATH111');
  });

  test('farklı bölümler için transkript ve müfredat ilerlemesi grafikleri doğru yüklenir', async ({ page }) => {
    await setupDepartmentsMock(page);
    await page.goto('/');

    // 1. Check CENG curriculum progress in modal
    await page.getByRole('button', { name: /^Transkript & Ön Koşul/ }).click();
    await expect(page.getByText('CENG Lisans Programı Müfredat İlerlemesi')).toBeVisible();
    await expect(page.getByText('12 / 45 ders', { exact: true })).toBeVisible();
    await expect(page.getByText('36 / 145 kredi', { exact: true })).toBeVisible();

    // Close modal
    await page.getByLabel('Kapat', { exact: true }).click();
    await expect(page.getByText('CENG Lisans Programı Müfredat İlerlemesi')).toHaveCount(0);

    // 2. Switch to IE department and open transcript again
    await page.locator('#primary-department').selectOption('IE');
    await page.getByRole('button', { name: /^Transkript & Ön Koşul/ }).click();
    await expect(page.getByText('IE Lisans Programı Müfredat İlerlemesi')).toBeVisible();
    await expect(page.getByText('12 / 45 ders', { exact: true })).toBeVisible();
    await expect(page.getByText('36 / 145 kredi', { exact: true })).toBeVisible();
  });

  test('farklı bölümler için ayrı taslak planlar (drafts) oluşturulup aralarında geçiş yapılabilir', async ({ page }) => {
    await setupDepartmentsMock(page);
    await page.goto('/');

    // Plan 1: CENG Plan
    await page.locator('div.group').filter({ hasText: 'CENG111' }).getByRole('button', { name: 'Ekle' }).click();
    await expect(page.locator('[data-weekly-grid]')).toContainText('CENG111');

    // Create Draft 2: "IE Planı"
    await page.getByRole('button', { name: 'Planlar' }).click();
    await page.getByPlaceholder('Yeni plan adı').fill('IE Planı');
    await page.getByRole('button', { name: 'Boş plan' }).click();

    // In Draft 2, switch to IE and add IE117
    await page.locator('#primary-department').selectOption('IE');
    await page.locator('div.group').filter({ hasText: 'IE117' }).getByRole('button', { name: 'Ekle' }).click();
    await expect(page.locator('[data-weekly-grid]')).toContainText('IE117');
    await expect(page.locator('[data-weekly-grid]')).not.toContainText('CENG111');

    // Switch back to Draft 1: "Varsayılan Plan"
    await page.getByRole('button', { name: 'Planlar' }).click();
    await page.getByRole('button', { name: 'Aç' }).first().click();

    // Original CENG course is preserved!
    await expect(page.locator('[data-weekly-grid]')).toContainText('CENG111');
  });

});
