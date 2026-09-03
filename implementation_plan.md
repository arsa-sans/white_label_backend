## 🔍 Rencana Verifikasi, Uji Overflow, & Kompilasi

### 1. Eksekusi Pembersihan & Verifikasi Build
```bash
# 1. Bersihkan build cache mobile (menghemat ~1.34 GB)
cd wl_mobile && flutter clean && flutter pub get

# 2. Analisis kode Flutter (Zero errors)
flutter analyze

# 3. Bersihkan & Build Frontend Next.js (Zero TypeScript / build errors)
cd ../wl_frontend && npm run build
```

### 2. Uji Bebas Overflow (Zero-Overflow Matrix)
* **Mobile Viewport ($375\text{px}$ & $390\text{px}$)**:
  * Verifikasi `document.documentElement.scrollWidth === window.innerWidth` (tidak ada horizontal scrollbar liar).
  * Drawer navigasi mobile terbuka dan tertutup dengan lancar.
* **Tablet Viewport ($768\text{px} - 1024\text{px}$)**:
  * Grid Bento bertransformasi proporsional dari 1 kolom ke 2 kolom.
* **Mobile App Rotation**:
  * Rotasi HP dari portrait ke landscape pada Booth Cashier beralih tata letak secara instan tanpa warning `RenderFlex overflowed`.

### 3. Jaminan Integritas Backend
* Menjalankan tes konektivitas API publik dan autentikasi untuk memastikan semua request/response payload tetap berfungsi 100% normal.
