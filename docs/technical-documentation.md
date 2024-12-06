# Dokumentasi Teknis Analisa Pertanian Indonesia App

## 📑 Daftar Isi
1. [Arsitektur Sistem](#arsitektur-sistem)
2. [Backend](#backend)
3. [Frontend](#frontend)
4. [Integrasi dan API](#integrasi-dan-api)
5. [Keamanan](#keamanan)
6. [Deployment](#deployment)

## 1. Arsitektur Sistem

### 1.1 Struktur Proyek
```
analisa-pertanian-indonesia-v1/
├── src/                  # Kode sumber frontend
│   ├── app.js           # Logika aplikasi utama
│   ├── main.js          # Komponen React utama
│   ├── data.js          # Manajemen data
│   └── components/      # Komponen React
├── assets/              # Aset statis
├── Images/              # Gambar dan media
├── docs/                # Dokumentasi
├── server.py            # Server Python
└── index.html           # File HTML utama
```

### 1.2 Teknologi yang Digunakan
- **Frontend**:
  * React 18
  * Vanilla JavaScript
  * Chart.js 4.x
  * Font Awesome Icons
  * Google Fonts (Inter)
- **Backend**:
  * Python (SimpleHTTPServer)
  * CORS support
  * Static file serving

## 2. Backend

### 2.1 Server Configuration (server.py)
```python
class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # CORS Configuration
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        return super().end_headers()
```

### 2.2 Content Type Handling
```python
def guess_type(self, path):
    if path.endswith('.js'):
        return 'application/javascript'
    if path.endswith('.html'):
        return 'text/html'
    if path.endswith('.css'):
        return 'text/css'
    return super().guess_type(path)
```

## 3. Frontend

### 3.1 Komponen Utama (main.js)
```javascript
function App() {
    const [activeTab, setActiveTab] = React.useState('musimTanam');

    return (
        <div className="container">
            <TabNavigation 
                activeTab={activeTab} 
                onTabChange={handleTabChange} 
            />
            <TabContent 
                activeTab={activeTab} 
                data={data} 
            />
        </div>
    );
}
```

### 3.2 Analisis Musim Tanam
```javascript
function MusimTanamAnalysis({ data }) {
    // Logika analisis musim tanam
    const analyzeWeather = (weatherData) => {
        return {
            suhu: calculateTemperatureIndex(weatherData),
            curahHujan: calculateRainfallIndex(weatherData),
            rekomendasi: generateRecommendations(weatherData)
        };
    };
}
```

### 3.3 Analisis Usaha Tani
```javascript
function UsahaTaniAnalysis({ data }) {
    // Perhitungan finansial
    const calculateFinancials = (inputData) => {
        return {
            bep: calculateBreakEvenPoint(inputData),
            roi: calculateReturnOnInvestment(inputData),
            bcRatio: calculateBenefitCostRatio(inputData)
        };
    };
}
```

## 4. Integrasi dan API

### 4.1 Data Management (data.js)
```javascript
const WEATHER_DATA = {
    regions: {
        "Jawa": {
            provinces: ["Jawa Barat", "Jawa Tengah", "Jawa Timur"],
            climate: "tropis"
        }
        // Data wilayah lainnya
    },
    crops: {
        "Padi": {
            optimal_temp: { min: 22, max: 30 },
            rainfall: { min: 200, max: 300 }
        }
        // Data tanaman lainnya
    }
};
```

### 4.2 Chart Configuration
```javascript
const chartConfig = {
    type: 'line',
    options: {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Analisis Cuaca'
            }
        }
    }
};
```

## 5. Keamanan

### 5.1 CORS Policy
- Implementasi CORS header di server
- Pembatasan metode HTTP yang diizinkan
- Cache control untuk data sensitif

### 5.2 Data Validation
```javascript
function validateInput(data) {
    const errors = {};
    
    if (!data.region) errors.region = "Wilayah harus dipilih";
    if (!data.crop) errors.crop = "Tanaman harus dipilih";
    if (data.area <= 0) errors.area = "Luas lahan harus lebih dari 0";
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}
```

## 6. Deployment

### 6.1 Requirements
- Python 3.x
- Node.js dan npm
- Modern web browser dengan JavaScript enabled

### 6.2 Installation Steps
1. Clone repositori
2. Install dependencies: `npm install`
3. Jalankan server: `python server.py`
4. Akses aplikasi di `http://localhost:8000`

### 6.3 Development Mode
```bash
# Menjalankan server development
python server.py

# Mengakses aplikasi
http://localhost:8000
```

### 6.4 Production Considerations
- Gunakan HTTPS untuk produksi
- Implementasikan rate limiting
- Optimalkan aset statis
- Pertimbangkan CDN untuk aset
