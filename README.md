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
- **💾 Dışa Aktarma**: Oluşturulan haftalık ders programını PNG görseli veya JSON olarak kaydetme imkanı.

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
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: `frontend/dist`
4. **Deploy** butonuna tıklayın. Vercel hem React ön yüzünü hem de `api/index.py` serverless FastAPI backend'ini otomatik olarak ayağa kaldıracaktır.

---

## 💻 Yerel Geliştirme (Web Sürümü)

### 1. Bağımlılıkları Yükleyin
```bash
# Python backend bağımlılıkları:
pip install -r requirements.txt

# React frontend bağımlılıkları:
npm --prefix frontend install
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

## 🖥️ Masaüstü Sürümü (PySide6)

Masaüstü Qt uygulamasını yerel bilgisayarınızda çalıştırmak isterseniz:

```bash
pip install -r requirements-desktop.txt
python main.py
```

> **Not**: Uygulama içerisinde güncel 587 derslik önbellek (`cankaya_courses.json`) hazır geldiği için ilk açılışta internetten veri çekmenize gerek kalmadan doğrudan program oluşturmaya başlayabilirsiniz.

