# Crypxamination

Crypxamination adalah aplikasi web sederhana untuk mempelajari alur enkripsi dan dekripsi soal ujian menggunakan algoritma RSA. Aplikasi berjalan langsung di browser dan tidak memerlukan backend maupun instalasi dependensi.

> Proyek ini ditujukan untuk pembelajaran dan demonstrasi, bukan untuk melindungi soal ujian atau data sensitif di lingkungan nyata. Implementasinya menggunakan RSA dasar tanpa padding dan ukuran kunci yang sangat kecil, sehingga tidak aman.

## Fitur

- Membangkitkan kunci RSA dari bilangan prima `p` dan `q`, atau mengacak nilai prima.
- Menampilkan kunci publik `(e, n)` dan kunci privat `(d, n)`.
- Mengelola mata pelajaran dan pasangan soal-jawaban.
- Mengenkripsi soal dan jawaban, lalu melihat ciphertext serta log perhitungan.
- Mendekripsi ciphertext dan melihat kembali soal serta jawabannya.
- Memfilter log dan ciphertext berdasarkan soal atau jawaban.
- Menyimpan status aplikasi di `localStorage` browser agar dapat dipulihkan saat halaman dibuka kembali.

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

Saat mengenkripsi, aplikasi menggabungkan tiap soal dan jawaban dengan pemisah `@`, dan pasangan berikutnya dengan pemisah `|`. Log memperlihatkan operasi RSA untuk setiap karakter.

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

## Batasan dan keamanan

- Nilai prima acak dibatasi pada rentang 11–97. Ukuran ini hanya memadai untuk demonstrasi; jangan gunakan kunci yang dihasilkan untuk keamanan nyata.
- RSA diimplementasikan secara langsung per kode karakter tanpa padding kriptografis. Cara ini tidak aman untuk penggunaan produksi.
- Agar pemulihan karakter benar, nilai modulus `n` harus lebih besar daripada kode karakter yang dienkripsi. Prima acak yang kecil dapat membuat karakter tertentu (termasuk sebagian karakter Unicode) tidak dapat dipulihkan dengan benar.
- Pemisah `@` dan `|` merupakan bagian dari format data; penggunaannya di dalam teks dapat mengganggu tampilan hasil dekripsi.
- Data soal, jawaban, ciphertext, serta kunci disimpan di `localStorage` pada browser yang sama. Penyimpanan tersebut bukan penyimpanan terenkripsi dan tidak disinkronkan antarperangkat.
- Untuk aplikasi ujian sungguhan, gunakan pustaka kriptografi tepercaya, manajemen kunci yang aman, skema enkripsi yang sesuai, dan evaluasi keamanan profesional.

## Struktur proyek

```text
.
├── index.html   # Struktur halaman dan elemen antarmuka
├── style.css    # Gaya dan tata letak
├── app.js       # Interaksi, alur aplikasi, dan penyimpanan localStorage
└── rsa.js       # Fungsi matematika RSA, enkripsi, dan dekripsi
```
