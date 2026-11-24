# SPDT – Bantu Entri (Auto Save + Rekap)

Ekstensi Chrome/Edge pembantu entri SPDT NTP: penanda baris aktif, auto-save berkala, titik jadi koma desimal, dan unduh rekap entry selesai per operator per hari.

- Hanya aktif di `https://spdtntp.web.bps.go.id/*`
- **Penanda kuning** pada baris yang sedang aktif/diisi (klik atau fokus di baris mana pun)
- **Auto-save berkala** di halaman edit dokumen (durasi bisa diatur; menekan tombol Simpan aplikasi)
- **Titik jadi koma** — ketik `.` untuk menghasilkan desimal `,` di field angka
- **Kunci navigasi blok** — tab Blok, judul blok & judul kolom tetap terlihat; hanya tabel yang di-scroll
- **Placeholder judul kolom** — isian kosong menampilkan judul kolomnya (mis. `H-1 Jumlah`)
- **Fuzzy search komoditas** — cari Jenis Barang di Blok V/VI tahan salah ketik & singkatan (mis. `bwg ptih`)
- **Backup draf dokumen** ke file, **filter status & operator** di Entri Data, dan **rekap entry** (.xls)
- Ikon ekstensi berwarna kuning
- **Halaman pengaturan** (klik ikon ekstensi) untuk menyalakan/mematikan tiap fitur & mengatur durasi auto-save

> Catatan: fitur **freeze kolom komoditas** dan **Enter = pindah input** telah dihapus mulai v1.8.0 karena server SPDT sudah menyediakan keduanya secara native.

## Backup draf dokumen (ke file)

Setiap kali tombol **Simpan** ditekan di halaman edit dokumen, ekstensi menangkap **payload lengkap dokumen** (seluruh isian Blok I–VII / K4, K5, K6, dll) — **baik penyimpanan ke server berhasil (200) maupun gagal (500)** — dan menyimpan **satu cadangan terbaru per dokumen** di storage ekstensi.

Berguna saat server gagal menyimpan (mis. bug SQL pada tabel `dbo.dokumen`): seluruh isian tetap punya salinan independen yang bisa **diunduh ke file `.json`**, terpisah dari draf lokal aplikasi.

Di popup bagian **Backup draf dokumen**:
- **Daftar** dokumen yang sudah tercadang (kabupaten · NURT · nama KRT · kuesioner · waktu; baris dokumen yang sedang dibuka disorot kuning; tanda "gagal" bila status ≠ 200).
- **⬇** unduh satu dokumen → `spdt_backup_<id>_K<kuesioner>_<waktu>.json`
- **✕** hapus satu cadangan dari storage ekstensi.
- **Unduh semua (.json)** → satu file berisi semua cadangan (sudah di-parse jadi objek `data`).
- **Pulihkan dari file** — *segera hadir* (fitur restore ditambahkan kemudian).

Catatan: cadangan tersimpan di storage ekstensi pada **profil browser ini**. Untuk pengamanan jangka panjang, **unduh ke file**. Cadangan menggunakan izin `unlimitedStorage` agar tidak terbatas kuota 5 MB.

## Kunci navigasi blok (form isian dokumen)

Di form isian (`/dokumen/<id>/edit`), terutama Blok IV dan V yang barisnya banyak, sebelumnya ada 3 scroll vertikal bertumpuk: halaman, kartu tengah, dan tabel. Kartu tengah ikut ter-scroll sehingga tab Blok, judul blok, dan judul kolom hilang ke atas. `fit-blok.js` menyetel tinggi maksimum area tabel agar pas dengan sisa ruang di kartu, jadi hanya tabel yang ter-scroll (judul kolom tetap menempel di atas). Tinggi dihitung ulang saat ganti tab, tambah baris, atau ukuran jendela berubah. Bisa dimatikan dari popup (**Kunci navigasi blok**).

## Placeholder judul kolom (form isian dokumen)

`placeholder-kolom.js` memberi placeholder pada setiap text input yang masih kosong di tabel isian, sesuai judul kolomnya, misalnya `H-1 Jumlah`, `H-3 Nilai (Rp)`, `Sebulan Jumlah`, atau `Umur (Tahun)`. Judul diambil dari header bertingkat (grup + sub-judul). Baris nomor kolom, judul grup berupa instruksi panjang, dan keterangan dalam kurung di judul grup tidak ikut. Judul yang panjang diawali nomor kolom, misalnya `(10) Jika Kol (8) …`, dan judul lengkapnya muncul sebagai tooltip. Placeholder otomatis hilang begitu sel diisi. Bisa dimatikan dari popup (**Placeholder judul kolom**).

## Fuzzy search komoditas (form isian dokumen)

Dropdown **Jenis Barang** di Blok V dan VI aslinya hanya mencari dengan cara "mengandung teks" (`contains`). `fuzzy-komoditas-hook.js` (MAIN world) mengganti computed `visibleOptions` pada setiap instance PrimeVue `Select` yang punya kotak cari dan minimal 30 opsi, sehingga pencariannya jadi fuzzy. Tidak ada komponen baru: kotak cari, daftar, navigasi keyboard, dan pemilihan tetap milik dropdown aslinya.

- Semua kata kunci harus cocok, urutannya bebas. Kata kunci dicocokkan ke label dan kode, misalnya `bwg ptih`, `putih bawang`, `tlur ayam`, `minyk goreng`, `clna pnjg`, atau `0117052`.
- Urutan kecocokan: substring (awal teks > awal kata > tengah kata), lalu salah ketik 1 huruf (kata ≥ 4 huruf) atau 2 huruf (kata ≥ 7 huruf), lalu huruf berurutan. Kode angka hanya dicocokkan sebagai substring.
- Hasil diurutkan dari yang paling cocok.
- Script ini juga memperbaiki bug bawaan: daftar hasil tampak kosong bila opsi yang sedang terpilih ada jauh di bawah (posisi virtual scroller tidak di-reset). Label baris juga tidak lagi kosong setelah dropdown ditutup dengan teks cari yang masih tertinggal.

Bisa dimatikan dari popup (**Fuzzy search komoditas**). Toggle diteruskan oleh `fuzzy-komoditas.js` lewat atribut `<html data-spdt-fuzzy>`.

## Filter status & operator (halaman Entri Data)

Di halaman `/sample`, kartu **Pencarian** mendapat panel **Filter Tambahan**. Semua perubahan diterapkan langsung pada **tabel Daftar Sampel asli**: paginasi, tombol bawaan (edit, dll), dan kotak Cari tetap berfungsi seperti biasa.

- **Status Dokumen**: Semua / Clean / Error / Belum (Clean = `flag_error "C"`, Error = `"E"`, Belum = belum ada dokumen).
- **Operator**: user kabupaten terpilih. Sampel cocok bila operator itu `user_created` **atau** `user_modified` dokumennya. Setelah filter aktif, daftar diurutkan berdasarkan jumlah dokumen, mis. "Wanda (11)". Kedua filter bisa digabung.
- Badge jumlah **Clean · Error · Belum** (mengikuti filter operator) dan tombol **↻ Muat ulang data**.
- Pilihan filter bertahan selama tab terbuka. Filter operator di-reset saat kabupaten diganti.
- Bisa dimatikan dari popup (**Filter status & operator**).

Cara kerja: server tidak punya filter status/operator, jadi `sample-filter-hook.js` (MAIN world) mencegat permintaan tabel `GET /api/sample`. Saat filter aktif, hook mengambil semua sampel (500/permintaan, cache 2 menit), menyaringnya, lalu mengembalikan halaman yang diminta dengan `meta.total` yang disesuaikan. Untuk memaksa tabel memuat ulang (aplikasi meng-cache hasil per kata Cari), `sample-filter.js` menambahkan penanda tak terlihat (karakter zero-width) di kotak Cari. Hook membuangnya dari URL, jadi pencarian ke server tidak berubah.

## Rekap entry

Di popup ada bagian **Rekap entry** dengan dua tombol. Data **hanya diambil saat tombol diklik** (tidak dimuat otomatis saat popup dibuka).

### Rekap sederhana
Klik **Rekap sederhana** → `rekap_sederhana_YYYYMMDD.xls`, 1 sheet **Petugas Entri**: jumlah entri per petugas (Produksi / Konsumsi / Total) per kabupaten, plus subtotal per kabupaten dan TOTAL. Sumber: `/api/tabulasi-progres?table=petugas_entri` (sama dengan menu Tabulasi → Progres). Hanya memakai isian Kabupaten.

### Rekap lengkap

- **Kabupaten**: isi kode kabupaten dipisah koma, mis. `9702, 9705, 9706`. **Tersimpan di memori browser**; bila belum ada, default diambil dari `/petugas`.
- **Kuesioner**: kode kuesioner (default `08`), tersimpan.
- **Subsektor**: kosong = semua subsektor; isi `1` untuk Tanaman Pangan (TP) — ini yang cocok dengan tampilan "Daftar Sampel" di UI.
- Klik **Rekap lengkap** → `rekap_entry_selesai_YYYYMMDD.xls`, 3 sheet:
  1. **Pivot Harian** — operator × tanggal (sampel selesai) + Total Selesai, Error
  2. **Ringkasan Kabupaten** — Total Sampel / Clean / Error / Belum per kabupaten
  3. **Detail** — satu baris per **sampel** (status, subsektor, operator, tanggal, NURT, Nama KRT, alamat)
- **Berbasis sampel**: universe = seluruh sampel (bukan hanya yang sudah dientry), jadi "Belum" mencakup sampel yang belum dikerjakan. Status per sampel untuk kuesioner terpilih: **Clean = `flag_error "C"`**, Error = `"E"`, Belum = belum ada dokumen/`flag` lain. Operator = `user_modified`, hari = `date_modified` (WIT).
- Data diambil langsung dari sesi login Anda (perlu login di tab SPDT); tidak ada data yang dikirim ke luar.
- Pengambilan data dijalankan di **tab SPDT** (lewat content script), bukan dari popup, agar lolos Cloudflare. Karena itu **harus ada tab SPDT yang terbuka & sudah login**. Jika muncul error "Tidak terhubung ke tab SPDT", refresh tab SPDT lalu coba lagi.

## Pengaturan

Klik ikon ekstensi (kuning) di toolbar untuk membuka pengaturan:

- **Auto-save** on/off + **Durasi** (detik, minimal 5)
- **Titik jadi koma** on/off
- **Penanda baris & kolom aktif** on/off (kolom aktif hanya di Blok V: judul kolom H-x / Jumlah-Nilai / nomor kolom jadi kuning, sel kolom diberi warna tipis)
- **Kunci navigasi blok** on/off
- **Placeholder judul kolom** on/off
- **Fuzzy search komoditas** on/off
- **Filter status & operator** on/off

Pengaturan tersimpan otomatis dan langsung berlaku di tab SPDT yang terbuka.

## Auto-save

- Hanya aktif di halaman `.../dokumen/<id>/edit`.
- Setiap 100 detik menekan tombol **Simpan** (ikon floppy) milik aplikasi — jadi yang tersimpan adalah data terbaru dengan token CSRF segar, bukan request yang diulang.
- Dilewati bila ada dialog/modal terbuka.
- Interval diatur dari popup (default 100 detik, minimal 5).

## Cara pasang (Chrome)

1. Buka `chrome://extensions`
2. Nyalakan **Developer mode** (pojok kanan atas)
3. Klik **Load unpacked**
4. Pilih folder `spdt-sticky-komoditas` ini
5. Buka/refresh halaman dokumen SPDT → scroll tabel ke kanan untuk mengetes

## Cara pasang (Microsoft Edge)

1. Buka `edge://extensions`
2. Nyalakan **Developer mode** (kiri bawah)
3. Klik **Load unpacked**
4. Pilih folder `spdt-sticky-komoditas` ini

Format ekstensi (Manifest V3) sama persis untuk Chrome dan Edge — satu folder dipakai di keduanya.

## File

- `manifest.json` – konfigurasi ekstensi
- `content.js` – penanda baris aktif + kolom aktif (Blok V)
- `entry-helpers.js` – titik jadi koma desimal
- `autosave.js` – auto-save dokumen berkala (durasi dari pengaturan)
- `backup-hook.js` – tangkap payload PUT dokumen (MAIN world)
- `backup.js` – simpan & kelola cadangan draf dokumen (content script)
- `fit-blok.js` – kunci navigasi blok (tinggi area tabel pas dengan kartu)
- `placeholder-kolom.js` – placeholder judul kolom pada isian kosong
- `fuzzy-komoditas-hook.js` – fuzzy search dropdown komoditas (MAIN world)
- `fuzzy-komoditas.js` – teruskan toggle fuzzy search ke MAIN world
- `sample-filter-hook.js` / `sample-filter.js` – filter status & operator di Entri Data
- `rekap.js` – hitung & bangun/unduh rekap .xls (popup)
- `rekap-bridge.js` – ambil data di tab SPDT atas permintaan popup (content script)
- `popup.html` / `popup.js` – halaman pengaturan + tombol rekap
- `tools/rekap-entry-selesai.js` – versi console mandiri (tempel di DevTools)
- `icons/` – ikon kuning (16/32/48/128)

## Changelog

### v1.16.0 — 2026-11-24
- **Baru: fuzzy search dropdown komoditas (Blok V & VI).** Pencarian Jenis Barang kini tahan salah ketik dan singkatan, tanpa komponen baru. Dropdown, kotak cari, navigasi keyboard, dan pemilihan tetap milik aplikasi.
  - Semua kata kunci harus cocok, urutannya bebas: `bwg ptih` / `putih bawang` → Bawang Putih, `tlur ayam`, `minyk goreng`, `clna pnjg`.
  - Salah ketik 1–2 huruf tetap ketemu (`bawnag` → Bawang …). Kode angka dicocokkan persis (`0117052`).
  - Hasil diurutkan dari yang paling cocok.
- **Perbaikan (bug bawaan aplikasi):** daftar hasil cari tampak kosong bila baris sudah berisi komoditas yang letaknya jauh di bawah daftar. Hasilnya ada, tapi tergambar di luar area terlihat.
- **Perbaikan:** nama komoditas di baris tidak lagi tampil kosong setelah dropdown ditutup dengan teks cari yang masih tertinggal. Nilai tersimpannya memang tidak pernah berubah.
- Toggle baru di popup: **Fuzzy search komoditas**.

### v1.15.0 — 2026-11-22
- **Baru: placeholder judul kolom.** Isian kosong di tabel menampilkan judul kolomnya (`H-1 Jumlah`, `Sebulan Nilai (000 Rp)`, `Umur (Tahun)`). Judul panjang diawali nomor kolom, dengan tooltip berisi judul lengkap.
- **Perbaikan: kunci navigasi blok** tidak lagi membuat tabel melompat ke atas saat mengubah isian di bagian bawah. Sebelumnya dropdown di baris bawah (mis. Satuan) ikut tertutup sehingga pilihan tidak tersimpan.
- **Rekap entry:** tombol **Rekap sederhana** (jumlah entri per petugas: produksi/konsumsi/total) dan **Rekap lengkap**. Data hanya diambil saat tombol diklik.

### v1.14.0 — 2026-11-18
- Kunci navigasi blok + penanda kolom aktif di Blok V. Kolom Operator di Entri Data dihapus.

### v1.12.0 — 2026-11-09
- Filter status dokumen & operator di halaman Entri Data.

### v1.9.0 — 2026-11-05
- Backup draf dokumen ke file. Fitur freeze kolom & Enter = pindah input dihapus karena sudah native di server.
