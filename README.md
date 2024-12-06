# 🌾 Petani Cerdas Indonesia

## 📑 Abstrak

Platform Petani Cerdas Indonesia adalah platform analisis pertanian berbasis web yang mengintegrasikan teknologi AI untuk membantu petani Indonesia dalam optimasi praktik pertanian, manajemen risiko, dan pengambilan keputusan. Aplikasi ini menyediakan empat modul analisis utama: (1) Analisis Musim Tanam yang membantu petani menentukan waktu tanam optimal berdasarkan data cuaca dan karakteristik tanaman, (2) Analisis Usaha Tani yang memungkinkan perhitungan kelayakan finansial dan proyeksi keuntungan, (3) Analisis Hama dan Penyakit yang menghitung ambang ekonomi dan memberikan rekomendasi pengendalian, serta (4) Analisis Penelitian yang menyediakan tools statistik untuk pengolahan data pertanian. Platform ini menggunakan React.js dan Tailwind CSS untuk antarmuka pengguna yang responsif, Chart.js untuk visualisasi data, dan integrasi Gemini AI untuk analisis prediktif. Fitur utama meliputi visualisasi data cuaca interaktif, perhitungan finansial otomatis, analisis ambang ekonomi hama, dan pengolahan statistik penelitian. Sistem memberikan rekomendasi berbasis AI untuk optimasi praktik pertanian dan manajemen risiko.

## 🛠️ Teknologi yang Digunakan

### Frontend
- React.js 18.2.0
- Tailwind CSS 3.3.0
- Chart.js 4.4.6 & react-chartjs-2 5.2.0

### Backend
- Python dengan CORS support
- Gemini API untuk analisis AI
- Real-time data processing

## 🚀 Cara Menjalankan Aplikasi di Windows

### Persiapan Awal (Hanya Sekali)
1. Install Python dari [python.org](https://www.python.org/downloads/)
   - ✅ Pastikan centang "Add Python to PATH" saat instalasi

2. Install Node.js dari [nodejs.org](https://nodejs.org/)
   - ✅ Pilih versi LTS (Long Term Support)

3. Download dan extract aplikasi ini ke folder yang diinginkan

### Instalasi (Pertama Kali)
1. Double click file `setup.bat`
2. Tunggu proses instalasi selesai
3. Jika ada error, ikuti petunjuk yang muncul

### Menjalankan Aplikasi
1. Double click file `start.bat`
2. Browser akan otomatis terbuka dengan aplikasi
3. Untuk menghentikan server, double click file `stop.bat`

### Troubleshooting
- Jika muncul error Python: Pastikan Python sudah terinstall dan ada di PATH
- Jika muncul error Node.js: Pastikan Node.js sudah terinstall dengan benar
- Jika browser tidak terbuka: Buka manual http://localhost:8000
- Jika port 8000 terpakai: Edit file server.py dan ganti port

## ✨ Fitur Utama

### 📊 Analisis Musim Tanam
- Visualisasi data cuaca dan iklim:
  * Grafik suhu bulanan (minimum dan maksimum)
  * Grafik curah hujan
  * Indikator musim (hujan/kemarau/transisi)
- Database tanaman lengkap:
  * Padi
    - Suhu optimal: 22-30°C
    - Kebutuhan air: 160-200mm/bulan
    - Periode tanam: 4 bulan
  * Jagung
    - Suhu optimal: 20-32°C
    - Kebutuhan air: 100-140mm/bulan
    - Periode tanam: 3.5 bulan
- Analisis kesesuaian musim tanam:
  * Evaluasi data cuaca real-time
  * Perhitungan fase pertumbuhan
  * Rekomendasi waktu tanam optimal
- Integrasi AI untuk analisis prediktif

### 💰 Analisis Usaha Tani
- Kalkulasi komprehensif:
  * Biaya produksi
  * Estimasi hasil panen
  * Analisis break-even point
  * Proyeksi keuntungan
- Analisis risiko finansial:
  * Evaluasi sensitivitas
  * Perhitungan ROI
  * Benefit-cost ratio
- Rekomendasi optimasi biaya

### 🐛 Analisis Hama dan Penyakit
- Sistem monitoring:
  * Deteksi dini serangan
  * Perhitungan ambang ekonomi
  * Analisis populasi hama
- Rekomendasi pengendalian:
  * Strategi pencegahan
  * Opsi pengendalian
  * Analisis biaya-manfaat
- Integrasi data historis

### 📈 Analisis Penelitian
- Tools statistik:
  * ANOVA
  * DMRT
  * Interval kepercayaan
- Visualisasi data:
  * Plot distribusi
  * Grafik komparasi
  * Analisis tren
- Interpretasi hasil berbasis AI

## 🎯 Fitur Khusus

### Integrasi AI (Gemini)
- Analisis prediktif cuaca
- Rekomendasi waktu tanam
- Prediksi serangan hama
- Optimasi keputusan finansial

### Visualisasi Data
- Chart.js interaktif
- Dashboard real-time
- Grafik multivariat
- Peta sebaran data

### Sistem Keamanan
- Autentikasi pengguna
- Enkripsi data
- Backup otomatis
- Monitoring akses

## 📱 Kompatibilitas
- Desktop (Windows, Mac, Linux)
- Mobile-responsive design
- Browser modern (Chrome, Firefox, Safari)
- Offline capability

## 🤝 Kontribusi
Kami menerima kontribusi untuk pengembangan platform ini. Silakan buat pull request atau laporkan issues di repository ini.

## 📄 Lisensi
Hak Cipta 2024 Petani Cerdas Indonesia. Dilindungi Undang-Undang.
