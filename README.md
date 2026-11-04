# SPDT – Freeze Kolom Komoditas

Ekstensi Chrome/Edge yang membuat **kolom komoditas (Kode + Jenis Barang)** pada tabel entri SPDT tetap menempel saat tabel discroll ke kanan. Berguna saat mengisi H-1 s/d H-7, Total, Jumlah Nilai, Tempat Berbelanja — komoditas tiap baris tidak lagi hilang dari layar.

- Hanya aktif di `https://spdtntp.web.bps.go.id/*`
- Tidak menambah tombol/UI apa pun — langsung jalan otomatis
- **Hanya kolom komoditas** yang dibekukan (No, Satuan, dan kolom nilai tetap ikut scroll)
- **Penanda kuning** pada baris yang sedang aktif/diisi (klik atau fokus di baris mana pun)
- **Auto-save berkala** di halaman edit dokumen (durasi bisa diatur; menekan tombol Simpan aplikasi)
- **Enter = pindah ke input berikutnya** (selain Tab)
- **Titik jadi koma** — ketik `.` untuk menghasilkan desimal `,` di field angka
- Ikon ekstensi berwarna kuning
- **Halaman pengaturan** (klik ikon ekstensi) untuk menyalakan/mematikan tiap fitur & mengatur durasi auto-save
- Menyesuaikan sendiri saat baris ditambah, pindah tab (Blok V/VI/VII), atau ukuran jendela berubah

## Rekap entry selesai

Di popup ada bagian **Rekap entry selesai**:

- **Kabupaten**: isi kode kabupaten dipisah koma, mis. `9702, 9705, 9706`. Nilai ini **tersimpan di memori browser**; bila belum ada, default diambil dari `/petugas` (kabupaten petugas digabung daftar Papua Pegunungan).
- **Kuesioner**: kode kuesioner (default `08`), juga tersimpan.
- **Tabel Clean / Error / Belum** per kabupaten tampil otomatis; tombol **↻ Refresh** untuk memperbarui manual.
- Klik **Unduh .xls** → `rekap_entry_selesai_YYYYMMDD.xls` berisi **semua tanggal**, 3 sheet:
  1. **Pivot Harian** — operator × tanggal (jumlah selesai) + Total Selesai, Error, Belum
  2. **Per Kuesioner** — operator × kode kuesioner
  3. **Detail** — satu baris per dokumen (ID, status, tanggal, NURT, Nama KRT, alamat)
- Definisi: **selesai = `flag_error "C"`**, error = `"E"`, belum = lainnya. Operator = `user_modified`, hari = `date_modified` (zona WIT/Asia-Jayapura).
- Data diambil langsung dari sesi login Anda (perlu login di tab SPDT); tidak ada data yang dikirim ke luar.

## Pengaturan

Klik ikon ekstensi (kuning) di toolbar untuk membuka pengaturan:

- **Auto-save** on/off + **Durasi** (detik, minimal 5)
- **Enter = pindah input** on/off
- **Titik jadi koma** on/off
- **Freeze kolom komoditas** on/off

Pengaturan tersimpan otomatis dan langsung berlaku di tab SPDT yang terbuka.

## Auto-save

- Hanya aktif di halaman `.../dokumen/<id>/edit`.
- Setiap 100 detik menekan tombol **Simpan** (ikon floppy) milik aplikasi — jadi yang tersimpan adalah data terbaru dengan token CSRF segar, bukan request yang diulang.
- Dilewati bila ada dialog/modal terbuka.
- Interval bisa diubah di `autosave.js` pada baris `INTERVAL_MS`.

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
- `content.js` – freeze kolom komoditas + penanda baris aktif
- `entry-helpers.js` – Enter pindah input + titik jadi koma desimal
- `autosave.js` – auto-save dokumen berkala (durasi dari pengaturan)
- `rekap.js` – ambil data + bangun & unduh rekap .xls (3 sheet)
- `popup.html` / `popup.js` – halaman pengaturan + tombol rekap
- `tools/rekap-entry-selesai.js` – versi console mandiri (tempel di DevTools)
- `icons/` – ikon kuning (16/32/48/128)
