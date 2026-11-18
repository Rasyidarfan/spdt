# SPDT – Bantu Entri (Auto Save + Rekap)

Ekstensi Chrome/Edge pembantu entri SPDT NTP: penanda baris aktif, auto-save berkala, titik jadi koma desimal, dan unduh rekap entry selesai per operator per hari.

- Hanya aktif di `https://spdtntp.web.bps.go.id/*`
- **Penanda kuning** pada baris yang sedang aktif/diisi (klik atau fokus di baris mana pun)
- **Auto-save berkala** di halaman edit dokumen (durasi bisa diatur; menekan tombol Simpan aplikasi)
- **Titik jadi koma** — ketik `.` untuk menghasilkan desimal `,` di field angka
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

## Filter status & operator (halaman Entri Data)

Di halaman `/sample`, kartu **Pencarian** mendapat panel **Filter Tambahan**. Semua perubahan diterapkan langsung pada **tabel Daftar Sampel asli**: paginasi, tombol bawaan (edit, dll), dan kotak Cari tetap berfungsi seperti biasa.

- **Status Dokumen**: Semua / Clean / Error / Belum (Clean = `flag_error "C"`, Error = `"E"`, Belum = belum ada dokumen).
- **Operator**: user kabupaten terpilih. Sampel cocok bila operator itu `user_created` **atau** `user_modified` dokumennya. Setelah filter aktif, daftar diurutkan berdasarkan jumlah dokumen, mis. "Wanda (11)". Kedua filter bisa digabung.
- Badge jumlah **Clean · Error · Belum** (mengikuti filter operator) dan tombol **↻ Muat ulang data**.
- Pilihan filter bertahan selama tab terbuka. Filter operator di-reset saat kabupaten diganti.
- Bisa dimatikan dari popup (**Filter status & operator**).

Cara kerja: server tidak punya filter status/operator, jadi `sample-filter-hook.js` (MAIN world) mencegat permintaan tabel `GET /api/sample`. Saat filter aktif, hook mengambil semua sampel (500/permintaan, cache 2 menit), menyaringnya, lalu mengembalikan halaman yang diminta dengan `meta.total` yang disesuaikan. Untuk memaksa tabel memuat ulang (aplikasi meng-cache hasil per kata Cari), `sample-filter.js` menambahkan penanda tak terlihat (karakter zero-width) di kotak Cari. Hook membuangnya dari URL, jadi pencarian ke server tidak berubah.

## Rekap entry selesai

Di popup ada bagian **Rekap entry selesai**:

- **Kabupaten**: isi kode kabupaten dipisah koma, mis. `9702, 9705, 9706`. **Tersimpan di memori browser**; bila belum ada, default diambil dari `/petugas`.
- **Kuesioner**: kode kuesioner (default `08`), tersimpan.
- **Subsektor**: kosong = semua subsektor; isi `1` untuk Tanaman Pangan (TP) — ini yang cocok dengan tampilan "Daftar Sampel" di UI.
- **Tabel Clean / Error / Belum** per kabupaten tampil otomatis; tombol **↻ Refresh** untuk memperbarui.
- Klik **Unduh .xls** → `rekap_entry_selesai_YYYYMMDD.xls`, 3 sheet:
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
- `rekap.js` – hitung & bangun/unduh rekap .xls (popup)
- `rekap-bridge.js` – ambil data di tab SPDT atas permintaan popup (content script)
- `popup.html` / `popup.js` – halaman pengaturan + tombol rekap
- `tools/rekap-entry-selesai.js` – versi console mandiri (tempel di DevTools)
- `icons/` – ikon kuning (16/32/48/128)
