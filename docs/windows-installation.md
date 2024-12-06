# 🖥️ Panduan Instalasi Windows

## 📋 Persyaratan Sistem
- Windows 8/10/11
- Minimal RAM 4GB
- Ruang disk kosong 500MB
- Koneksi internet

## 🔧 Software yang Diperlukan

### 1. Python
- Download Python 3.8 atau lebih baru dari [python.org](https://www.python.org/downloads/)
- Saat instalasi:
  * ✅ Centang "Add Python to PATH"
  * ✅ Centang "Install pip"
  * ✅ Centang "Install for all users" (opsional)

### 2. Node.js
- Download Node.js LTS dari [nodejs.org](https://nodejs.org/)
- Ikuti langkah instalasi default
- Pastikan npm terinstall otomatis

## 📥 Instalasi Aplikasi

### Cara 1: Menggunakan File Batch (Rekomendasi)
1. Extract file aplikasi ke folder yang diinginkan
2. Double click `setup.bat`
3. Tunggu proses instalasi selesai
4. Jika sukses, akan muncul pesan "Instalasi selesai!"

### Cara 2: Instalasi Manual
1. Buka Command Prompt sebagai Administrator
2. Navigasi ke folder aplikasi:
   ```cmd
   cd path/to/analisa-pertanian-indonesia
   ```
3. Install dependencies Python:
   ```cmd
   pip install -r requirements.txt
   ```
4. Install dependencies Node.js:
   ```cmd
   npm install
   ```

## 🚀 Menjalankan Aplikasi

### Menggunakan Batch File
1. Double click `start.bat`
2. Browser akan terbuka otomatis
3. Aplikasi siap digunakan

### Manual Start
1. Buka Command Prompt
2. Jalankan server:
   ```cmd
   python server.py
   ```
3. Buka browser ke http://localhost:8000

## ❗ Troubleshooting

### Error: Python tidak ditemukan
- Pastikan Python terinstall
- Cek dengan mengetik `python --version` di Command Prompt
- Jika error, install ulang Python dan centang "Add Python to PATH"

### Error: Node.js tidak ditemukan
- Pastikan Node.js terinstall
- Cek dengan mengetik `node --version` di Command Prompt
- Jika error, install ulang Node.js

### Error: Port 8000 sudah digunakan
1. Buka file `server.py`
2. Ubah nomor port (misal dari 8000 ke 8080)
3. Simpan dan jalankan ulang aplikasi

### Error: Module tidak ditemukan
1. Buka Command Prompt sebagai Administrator
2. Jalankan:
   ```cmd
   pip install -r requirements.txt --force-reinstall
   ```

### Browser tidak terbuka otomatis
- Buka browser manual
- Ketik alamat: http://localhost:8000

## 📞 Bantuan Tambahan

### Kontak Support
- Email: support@analisapertanian.id
- Jam kerja: 08.00 - 17.00 WIB

### Link Penting
- Dokumentasi: docs/user-manual.md
- Source code: https://github.com/username/analisa-pertanian
- Issues/Bugs: https://github.com/username/analisa-pertanian/issues

### Pembaruan Aplikasi
1. Backup folder `data` (jika ada)
2. Download versi terbaru
3. Extract ke folder baru
4. Jalankan `setup.bat`
5. Restore folder `data` (jika ada)
