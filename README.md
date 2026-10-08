# Crypxamination

Crypxamination adalah aplikasi web sederhana untuk mempelajari alur enkripsi dan dekripsi soal ujian menggunakan algoritma RSA. Aplikasi berjalan langsung di browser dan tidak memerlukan backend maupun instalasi dependensi.

> Proyek ini ditujukan untuk pembelajaran dan demonstrasi, bukan untuk melindungi soal ujian atau data sensitif di lingkungan nyata. Implementasinya menggunakan RSA dasar tanpa padding dan ukuran kunci yang sangat kecil, sehingga tidak aman.

## Identitas Kelompok
 
| Nama  | NRP        |
| ----- | ---------- |
| Tiara | 5027241013 |
| Diva  | 5027241083 |
| Oscar | 5027241053 |

## Fitur

- **Role-Based Access Control (RBAC):** Memisahkan akses antara Guru dan Murid.
- **Autentikasi (Supabase):** Menyimpan data sesi dan state tersinkronisasi di cloud menggunakan Supabase, dengan fallback ke `localStorage`.
- Membangkitkan kunci RSA dari bilangan prima `p` dan `q`, atau mengacak nilai prima.
- Menampilkan kunci publik `(e, n)` dan kunci privat `(d, n)`.
- Mengelola mata pelajaran dan pasangan soal-jawaban (Guru).
- Mengenkripsi soal dan jawaban, lalu melihat ciphertext serta log perhitungan.
- Halaman Ujian khusus (`exam.html`) bagi Murid untuk menjawab soal.
- Enkripsi hasil ujian (Soal, Kunci Jawaban, dan Jawaban Murid) setelah selesai.
- Sistem **2 Lapis Kata Sandi 6 Digit** per mata pelajaran (diatur oleh Guru):
  - **Sandi Buka Soal:** Digunakan murid untuk melihat soal asli saat mengerjakan ujian.
  - **Sandi Buka Hasil:** Digunakan untuk mendekripsi nilai/hasil ujian.

## Menjalankan aplikasi

1. Unduh atau clone repositori ini.
2. Buka `index.html` di browser modern yang mendukung JavaScript `BigInt`.
3. Tidak ada proses build atau instalasi paket yang diperlukan.

Jika browser membatasi fitur saat file dibuka langsung, jalankan server web statis dari folder proyek, lalu buka alamat lokal yang ditampilkan server. Contohnya, jika Python tersedia:

```bash
python -m http.server 8000
```

Kemudian buka `http://localhost:8000`.

## Cara menggunakan

1. **Pembangkitan Kunci:** masukkan dua bilangan prima `p` dan `q`, atau pilih **Acak P & Q**, lalu tekan **Bangkitkan Kunci**.
2. **Input Soal & Jawaban:** tambahkan mata pelajaran, isi satu atau beberapa pasangan soal-jawaban, lalu tekan **Enkripsi Semua Soal & Jawaban**.
3. **Dekripsi & Hasil:** pilih mata pelajaran dan tekan tombol dekripsi untuk melihat kembali teks serta log operasi.

Saat mengenkripsi, aplikasi menggabungkan tiap soal dan jawaban dengan pemisah `_=_SEP_QNA_=_`, dan pasangan berikutnya dengan pemisah `_=_SEP_ITEM_=_` untuk mencegah error saat pengguna memasukkan karakter khusus. Log memperlihatkan operasi RSA untuk setiap karakter.

## Gambaran algoritma

Untuk prima `p` dan `q`, aplikasi menghitung:

```text
n   = p × q
φ(n) = (p − 1) × (q − 1)
```

Aplikasi memilih eksponen publik `e` yang relatif prima terhadap `φ(n)`, kemudian menghitung eksponen privat `d` sebagai invers modular `e` terhadap `φ(n)`. Enkripsi dan dekripsi setiap kode karakter dilakukan dengan:

```text
Enkripsi:  c = m^e mod n
Dekripsi:  m = c^d mod n
```

Implementasi fungsi matematika RSA dan konversi karakter berada di `rsa.js`; alur antarmuka dan penyimpanan browser berada di `app.js`.

### Pemilihan e dan d
 
- **Memilih `e`:** aplikasi mencoba `e = 65537`. Jika nilai itu tidak kurang dari `φ(n)` atau tidak relatif prima dengan `φ(n)`, `e` dicari mulai dari 3 (bilangan ganjil) sampai ditemukan yang relatif prima dengan `φ(n)` (`gcd(e, φ(n)) = 1`).
- **Menghitung `d`:** `d` adalah invers modular dari `e` terhadap `φ(n)`, sehingga `e x d ≡ 1 (mod φ(n))`. Dihitung dengan Extended Euclidean Algorithm.
- Perpangkatan modular dihitung dengan metode kuadrat berulang (square-and-multiply), sehingga angka antara selalu di-`mod n` dan tidak membesar.
### Contoh perhitungan (p = 11, q = 13)
 
| Langkah | Perhitungan                                                          | Hasil |
| ------- | -------------------------------------------------------------------- | ----- |
| n       | 11 x 13                                                              | 143   |
| φ(n)    | (11 - 1) x (13 - 1) = 10 x 12                                        | 120   |
| e       | 65537 lebih besar dari 120, maka dicari: 3 dan 5 tidak relatif prima dengan 120, 7 relatif prima | 7 |
| d       | 7 x 103 = 721 = 6 x 120 + 1                                          | 103   |
 
Kunci publik `(e = 7, n = 143)` dan kunci privat `(d = 103, n = 143)`. Enkripsi teks `Hai`:
 
| Karakter | ASCII (m) | Enkripsi `m^7 mod 143` | Ciphertext | Dekripsi `c^103 mod 143` |
| -------- | --------- | ---------------------- | ---------- | ------------------------ |
| H        | 72        | 72^7 mod 143           | 19         | 72 -> H                  |
| a        | 97        | 97^7 mod 143           | 59         | 97 -> a                  |
| i        | 105       | 105^7 mod 143          | 118        | 105 -> i                 |
 
Ciphertext lengkap: `19,59,118`.
 
### Perbedaan dengan contoh di materi kuliah
 
Materi kuliah mencontohkan teks yang diubah menjadi angka (A=00 sampai Z=25), dipecah menjadi blok beberapa digit, lalu tiap blok dienkripsi. Aplikasi ini memilih cara yang lebih sederhana: setiap karakter dienkripsi sendiri-sendiri dengan kode ASCII-nya agar log perhitungan mudah dibaca. Syarat dasar RSA tetap sama, yaitu nilai plaintext `m` harus berada pada selang `[0, n-1]`. Konsekuensinya, cara ini deterministik (karakter yang sama selalu menghasilkan ciphertext yang sama) sehingga pola teks bisa ditebak.
 
## Pengujian
 
Pengujian dilakukan dengan menjalankan fungsi di `rsa.js` (pembangkitan kunci, enkripsi, lalu dekripsi) pada beberapa masukan.
 
| No | Masukan                                  | Hasil yang diharapkan                                         | Hasil                                                            |
| -- | ---------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1  | p=11, q=13, teks `Hai`                   | e=7, d=103, ciphertext `19,59,118`, dekripsi kembali ke `Hai` | Sesuai                                                           |
| 2  | p=61, q=53, teks berisi soal dan jawaban | Dekripsi sama dengan teks asli                                | Sesuai                                                           |
| 3  | p=5, q=7 (n=35), teks `Halo`             | Dekripsi sama dengan teks asli                                | **Gagal**: kode ASCII lebih besar dari n                         |
| 4  | p=11, q=11, teks `Halo`                  | Dekripsi sama dengan teks asli                                | **Gagal**: p = q membuat φ(n) salah                              |
| 5  | p=251, q=257, teks `Café`                  | Dekripsi sama dengan teks asli                                | Sesuai (karena n = 64507 > 233)                                  |
 
Kasus 3 dan 4 adalah keterbatasan matematis RSA yang diketahui (lihat bagian Batasan dan keamanan). Kasus batas nilai ASCII (Kasus 5) telah diperbaiki dengan menaikkan rentang acak minimum.

## Batasan dan keamanan

- Nilai prima acak dibatasi pada rentang 250–999. Ukuran ini cukup untuk mencakup nilai ASCII/Unicode teks, tapi hanya memadai untuk demonstrasi; jangan gunakan kunci yang dihasilkan untuk keamanan nyata.
- RSA diimplementasikan secara langsung per kode karakter tanpa padding kriptografis. Cara ini tidak aman untuk penggunaan produksi (rentan *frequency analysis*).
- Data soal, jawaban, ciphertext, serta kunci disimpan di `localStorage` pada browser dan state dasar (Supabase). Penyimpanan lokal dibuat spesifik per-email agar tidak tertukar, namun tetap tidak disarankan untuk data sensitif sesungguhnya.
- Untuk aplikasi ujian sungguhan, gunakan pustaka kriptografi tepercaya, manajemen kunci yang aman, skema enkripsi yang sesuai, dan evaluasi keamanan profesional.

## Cakupan
 
**Termasuk:**
 
- [x] Pembangkitan kunci RSA dari `p` dan `q`
- [x] Enkripsi dan dekripsi per karakter dengan log perhitungan
- [x] Pengelolaan mata pelajaran dan pasangan soal-jawaban
- [x] Penyimpanan status di `localStorage`

## Struktur proyek

```text
.
├── index.html          # Dasbor utama Guru (Pembangkitan Kunci, Input Soal)
├── exam.html           # Halaman khusus Murid untuk mengerjakan ujian
├── login.html          # Halaman autentikasi/login
├── style.css           # Gaya dan tata letak
├── app.js              # Logika Dasbor Guru (Enkripsi/Dekripsi Guru, Manajemen Sandi)
├── exam.js             # Logika Pengerjaan Ujian dan Enkripsi/Dekripsi Hasil (Siswa)
├── auth.js             # Logika Autentikasi dan Cek Sesi (Supabase)
├── supabaseConfig.js   # Konfigurasi Koneksi Klien Supabase
└── rsa.js              # Fungsi matematika RSA murni
```
