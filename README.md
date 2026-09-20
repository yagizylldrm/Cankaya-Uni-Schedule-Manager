# 🎓 Çankaya Üniversitesi Ders Programı Oluşturucu (Schedule Manager)

Çankaya Üniversitesi öğrenci işleri web sitesinden açılan dersleri ve saatlerini otomatik çeken, haftalık çakışmasız ders programı kombinasyonları üreten, kredi/AKTS takibi ve özel etkinlik planlaması sunan modern masaüstü uygulaması.

---

## 🚀 Özellikler

- **⚡ Otomatik Ders & Program Çekme**: Çankaya Üniversitesi web sitesinden tüm bölümlerin açılan derslerini, şubelerini, saatlerini, öğretim elemanlarını ve dersliklerini çeker.
- **🔄 Çakışmasız Program Kombinasyonları**: Seçilen derslerin tüm şube ihtimallerini değerlendirir ve haftalık çakışmasız alternatif programları üretir.
- **🎨 Çift Tema Desteği**:
  - **☀️ Açık Tema (Çankaya)**: Üniversitenin resmi kurumsal renkleri (Lacivert `#002855` & Altın Sarısı `#d49a17`).
  - **🌙 Karanlık Tema**: Gözü yormayan modern koyu tema.
- **🎓 Yandal & ÇAP Müfredat Desteği**: Ana bölüm ve ikinci bölüm (Yandal veya Çift Anadal) kombinasyonuna göre ortak ders muafiyetlerini hesaplar ve dersleri `📌 Zorunlu`, `🟣 ÇAP Zorunlu`, `🔵 Yandal Zorunlu` veya `🔹 Seçmeli` olarak sınıflandırır.
- **💳 Kredi ve AKTS Takibi**: Sepetteki derslerin toplam yerel kredi, AKTS ve haftalık ders saatini canlı olarak hesaplar.
- **📍 Sınıf / Derslik Bilgisi**: Okul sitesinde belirtilmişse dersin işleneceği sınıfı (örn. `LA-01`, `B-102`) takvimde ve detay kartlarında gösterir.
- **📖 Ders Bilgisi & Web Sayfası**: Takvimdeki veya aramadaki bir derse tıklandığında dersin tanımı, konuları ve resmi ders web sitesine (`http://{kod}.cankaya.edu.tr`) doğrudan bağlantı sağlar.
- **✏️ Özel Etkinlik & Mola Ekleme**: Boş kutulara tıklayarak `🍔 Yemek Arası`, `☕ Mola`, `📚 Ders Çalışma`, `🏋️ Spor` gibi özel bloklar eklenebilir.
- **💾 Kaydetme ve Geri Yükleme**: Seçili şubeler, ders sepeti, tercihler ve etkinlikler JSON dosyasına kaydedilir; dosya ön izleme ile geri yüklenebilir. Transkript ve notlar dosyaya eklenmez. Seçili program tarayıcıda da korunur.
- **📅 Takvim Aktarımı**: Dönem başlangıç/bitiş tarihleriyle `.ics` çıktısı; İstanbul saatine göre haftalık dersler. Kişisel etkinlikler isteğe bağlıdır, tatiller otomatik çıkarılmaz. PNG ve yazdırma/PDF çıktıları haftalık görünümü kullanır.
- **🔔 Güncel Program Durumu**: Ders eklenip çıkarıldığında veya şube seçimi değiştiğinde önizleme hemen güncellenir ve uygun programlar otomatik hesaplanır. Tercih veya etkinlik değişince eski program işaretlenir. Yeniden oluşturulana kadar dışa aktarma kapatılır.
- **📊 CSV Dışa Aktarma**: Kaydet / Yükle menüsünden seçili programın ders, şube, gün, başlangıç/bitiş saati, öğretim elemanı, derslik ve kredi bilgileri CSV olarak indirilebilir. Türkçe karakterler korunur; kişisel etkinlikler isteğe bağlıdır, transkript ve notlar aktarılmaz.
- **📱 Mobil Günlük Görünüm**: İlk kullanımda bölüm ve ders seçimi rehberi; günlük ajanda, haftalık görünüm ve etkinlik ekleme.
- **🔎 Çakışma Açıklamaları**: Çakışan ders/şube ve saat bilgileri; çözüm sağlayacağı doğrulanmış tercih veya etkinlik değişiklikleri tek tıkla uygulanabilir. Karmaşık durumlarda sepeti inceleme önerilir.

---

## 🌐 Web & Vercel Dağıtımı (React + FastAPI)

Uygulama artık hem masaüstü (Qt/PySide6) hem de modern bir web uygulaması (React + Tailwind CSS + FastAPI) olarak çalıştırılabilir ve tek tıkla **Vercel** üzerine deploy edilebilir.

### 🚀 Vercel'e Deploy Etme

1. Projeyi GitHub hesabınıza push edin:
   ```bash
   git add .
   git commit -m "Add React frontend, FastAPI backend, and Vercel configuration"
   git push origin main
   ```
2. [Vercel](https://vercel.com/) paneline giriş yapıp **"Add New Project"** seçeneğinden bu depoyu seçin.
3. Vercel, kök dizindeki `vercel.json` dosyasını otomatik olarak algılar:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Deploy** butonuna tıklayın. Vercel hem React ön yüzünü hem de `api/index.py` serverless FastAPI backend'ini otomatik olarak ayağa kaldıracaktır.

---

## 💻 Yerel Geliştirme (Web Sürümü)

### 1. Bağımlılıkları Yükleyin
```bash
# Python backend bağımlılıkları:
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

## 🖥️ Masaüstü Sürümü (PySide6)

Masaüstü Qt uygulamasını yerel bilgisayarınızda çalıştırmak isterseniz:

```bash
pip install -r requirements-desktop.txt
python main.py
```

> **Not**: Uygulama içerisinde güncel 587 derslik önbellek (`cankaya_courses.json`) hazır geldiği için ilk açılışta internetten veri çekmenize gerek kalmadan doğrudan program oluşturmaya başlayabilirsiniz.

