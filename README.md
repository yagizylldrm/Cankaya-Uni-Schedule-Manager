# 🎓 Çankaya Üniversitesi Ders Programı Oluşturucu (Schedule Manager)

Çankaya Üniversitesi'nin açılan derslerinden haftalık çakışmasız programlar oluşturan web uygulaması. Kredi/AKTS takibi, özel etkinlikler ve yerel plan taslakları içerir. Qt masaüstü sürümü eski sürüm olarak korunur.

---

## 🚀 Özellikler

- **⚡ Otomatik Ders & Program Çekme**: Çankaya Üniversitesi web sitesinden tüm bölümlerin açılan derslerini, şubelerini, saatlerini, öğretim elemanlarını ve dersliklerini çeker.
- **🔄 Çakışmasız Program Kombinasyonları**: Seçilen derslerin şubelerini değerlendirir; aynı haftalık saat düzenini oluşturan şubeleri tek program olarak sayar.
- **🎨 Çift Tema Desteği**:
  - **☀️ Açık Tema (Çankaya)**: Üniversitenin resmi kurumsal renkleri (Lacivert `#002855` & Altın Sarısı `#d49a17`).
  - **🌙 Karanlık Tema**: Gözü yormayan modern bir koyu tema.
- **🎓 Yandal & ÇAP Müfredat Desteği**: Ana bölüm ve ikinci bölüm (Yandal veya Çift Anadal) kombinasyonuna göre ortak ders muafiyetlerini hesaplar ve dersleri `📌 Zorunlu`, `🟣 ÇAP Zorunlu`, `🔵 Yandal Zorunlu` veya `🔹 Seçmeli` olarak sınıflandırır.
- **💳 Kredi ve AKTS Takibi**: Sepetteki derslerin toplam yerel kredisini, AKTS'ini ve haftalık ders saatini canlı olarak hesaplar.
- **📍 Sınıf / Derslik Bilgisi**: Okul sitesinde belirtilmişse dersin işleneceği sınıfı (örn. `LA-01`, `B-102`) takvimde ve detay kartlarında gösterir.
- **📖 Ders Bilgisi & Web Sayfası**: Takvimdeki veya aramadaki bir derse tıklandığında dersin tanımı, konuları ve resmi ders web sitesine (`http://{kod}.cankaya.edu.tr`) doğrudan bağlantı sağlar.
- **✏️ Özel Etkinlik & Mola Ekleme**: Boş kutulara tıklayarak `🍔 Yemek Arası`, `☕ Mola`, `📚 Ders Çalışma`, `🏋️ Spor` gibi özel bloklar eklenebilir.
- **💾 Kaydetme ve Geri Yükleme**: Plan taslakları tarayıcıda otomatik kaydedilir. Seçili şubeler, tercihler ve etkinlikler ayrıca JSON dosyasına aktarılabilir. Transkript ve notlar plan dosyasına eklenmez.
- **📅 Takvim Aktarımı**: Dönem başlangıç/bitiş tarihleriyle `.ics` çıktısı; İstanbul saatine göre haftalık dersler. Kişisel etkinlikler isteğe bağlıdır; tatiller otomatik olarak çıkarılmaz. PNG ve yazdırma/PDF çıktıları haftalık görünümü kullanır.
- **🔔 Güncel Program Durumu**: Ders eklenip çıkarıldığında veya şube seçimi değiştiğinde önizleme hemen güncellenir ve uygun programlar otomatik olarak hesaplanır. Seçilen tercihlere uygun yeni program bulunamazsa son geçerli program korunur ve neden bulunamadığı gösterilir.
- **📊 CSV Dışa Aktarma**: Kaydet / Yükle menüsünden seçili programın ders, şube, gün, başlangıç/bitiş saati, öğretim elemanı, derslik ve kredi bilgileri CSV olarak indirilebilir. Türkçe karakterler korunur; kişisel etkinlikler isteğe bağlıdır, transkript ve notlar aktarılmaz.
- **📱 Mobil Günlük Görünüm**: İlk kullanımda bölüm ve ders seçimi rehberi; günlük ajanda, haftalık görünüm ve etkinlik ekleme.
- **🔎 Çakışma Açıklamaları**: Çakışan ders/şube ve saat bilgileri; çözüm sağlayacak doğrulanmış tercih veya etkinlik değişiklikleri tek tıkla uygulanabilir. Karmaşık durumlarda sepeti incelemek önerilir.

---

## 💻 Yerel Geliştirme (Web Sürümü)

### 1. Bağımlılıkları Yükleyin
```bash
# Python backend bağımlılıkları (önce .venv oluşturup etkinleştirin):
pip install -r requirements.txt

# React frontend bağımlılıkları:
npm install
```

### 2. Geliştirme Sunucularını Başlatın
İki ayrı terminalde veya kök komutlarla:

**Terminal 1 (FastAPI Backend):**
```bash
python -m uvicorn api.index:app --reload --port 8000
# veya:
npm run dev:api
```

**Terminal 2 (React Frontend):**
```bash
npm run dev:frontend
```
Tarayıcınızda `http://localhost:5173` adresine giderek uygulamayı kullanabilirsiniz.

---

## 🧪 Web Testleri

### Ders programı verilerini yenileme

`python refresh_schedules.py` komutu [açılan dersler listesindeki](https://www.cankaya.edu.tr/dersler/)
derslerin haftalık program bağlantılarını takip ederek tek kaynak olan
`api/cankaya_courses.json` dosyasını yeniler. Tüm sayfalar başarıyla okunmadan önbellek
değiştirilmez. Kaynak adresi, dönem ve çekilme tarihi de kaydedilir. WebOnline ve Hazırlık
Sınıfı bağlantıları ders değildir ve sayılmaz. Resmî sayfasında programı bulunmayan dersler
boş şube listesiyle tutulur; bunlara saat veya şube uydurulmaz. Yeni kaynakta öğretim elemanı
bilgisi bulunmadığı için bu alan `Belirsiz` kalır; derslikler her saat için ayrı saklanır.

Web uygulaması bu dosyayı okur; canlı sitede yeni verilerin kullanılması için güncellenmiş
dosyalarla yeniden dağıtım yapılmalıdır. Scraper testleri: `python -m unittest discover -s tests -p test_scraper.py`.

`python refresh_prerequisites.py --ceng-only`, CENG bölümünün 2022–2023 güz ve sonrası
müfredatının tamamını (MATH, PHYS gibi ortak dersler dahil) resmî bölüm sayfasından
yeniler; kaynak bağlantısını ve doğrulama tarihini saklar. Bu kurallar yalnızca ana
bölüm CENG seçildiğinde uygulanır; diğer programların kurallarını değiştirmez.
Canlı kaynağa erişilemezse mevcut kayıtlar korunur. Ön koşul kaydı
bulunmayan dersler “bilgi eksik” olarak gösterilir; ders numarasından ön koşul tahmin
edilmez. “Yalnızca alınabilir” filtresi bu doğrulanmamış dersleri kapsamaz.

Tüm bölümlerin Bilgi Paketi kayıtları önce `python collect_prerequisites.py` ile
toplanır. `python refresh_course_catalog.py --refresh-sources` en güncel müfredatları,
bölümlerin ön koşul tablolarını ve Açılan Dersler'deki ders adlarını birleştirir.
Ön koşul şeması değiştiyse `department_prerequisite_overrides.json` içindeki kuralların
gözden geçirilmesini ister. Kaynağında boş veya çelişkili ön koşul bulunan dersler
"bilgi doğrulanmadı" olarak gösterilir. `python refresh_instructors.py`, Açılan
Dersler'in bağlantılarını ve resmî haftalık programı kontrol ederek eşleşen şubelere
öğretim elemanı adını yazar. Yalnız eski ders sayfasında adı bulunan kişi şube hocası
olarak atanmaz; kaynak ve sayfa tarihi ders ayrıntısında ayrı gösterilir.
`python refresh_instructors.py --programs-only`, ders sayfalarındaki mevcut referansları
koruyarak güncel haftalık program eşleşmelerini yeniler. Bölümün ayrıca yayımladığı
programdan doğrulanan adlar `department_instructor_overrides.json` içinde kaynak,
dönem, şube, derslik ve saatleriyle saklanır; program değişirse eşleşme uygulanmaz.

GitHub Actions her pazartesi açılan dersleri kontrol eder; değişiklik bulursa inceleme için
bir pull request açar. Bunun çalışması için depoda Actions'ın PR oluşturma izni açık olmalıdır.
Bilgi Paketi yenilemesinde `CANKAYA_EBS_TOKEN` ortam değişkeni gereklidir; token yoksa
mevcut önbellek değiştirilmez.

```bash
pip install -r requirements-dev.txt
npm install
npx playwright install chromium
npm test
npm run test:api
npm run test:e2e
npm run build
```

Tarayıcı testleri Vite'ı otomatik başlatır ve tekrarlanabilir ders verileri kullanır. API testleri Python zamanlama motorunu ve FastAPI uç noktalarını kontrol eder. Takvim çıktısı [iCalendar (RFC 5545)](https://www.rfc-editor.org/rfc/rfc5545) biçimini kullanır.

## 🖥️ Eski Masaüstü Sürümü (PySide6)

Masaüstü Qt uygulamasını yerel bilgisayarınızda çalıştırmak isterseniz:

```bash
pip install -r requirements-desktop.txt
python main.py
```

> **Not**: Masaüstü sürümü web uygulamasındaki plan JSON içe aktarma, CSV ve takvim dışa aktarma özelliklerini içermez. Ders önbelleği `api/` altında gelir.

