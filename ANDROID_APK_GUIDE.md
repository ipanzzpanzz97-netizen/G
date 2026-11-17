# Panduan Build & Download APK Android di GitHub

Project **Bilik Tropis: RTX Physics** sudah dilengkapi konfigurasi **Capacitor Android (`capacitor.config.ts`)**, **Kontrol Layar Sentuh Android (Virtual Joystick + Touch Look + Tombol Aksi)**, dan workflow otomatis **GitHub Actions (`.github/workflows/build-android-apk.yml`)**.

## Cara Mendapatkan File `.apk` di GitHub (Otomatis)

1. **Push semua file project ini ke repository GitHub** Anda (`main` atau `master`).
2. GitHub Actions akan otomatis menjalankan workflow **`Build Android APK`**.
3. Setelah selesai (~2–3 menit), buka tab **Actions** di repository GitHub Anda, pilih workflow run terbaru, lalu download **`BilikTropis-Android-APK`** di bagian **Artifacts** (berisi `BilikTropis-Android.apk`).
4. **Opsional (Halaman Releases)**: Jika Anda push tag versi (mis. `git tag v1.0.0 && git push origin v1.0.0`) atau menekan **Run workflow** secara manual di tab Actions, GitHub akan otomatis membuat **GitHub Release** sehingga `BilikTropis-Android.apk` bisa langsung di-download dari halaman **Releases**!

## Kontrol di HP Android

- **Joystick Kiri**: Gerak (`WASD`), dorong ke tepi luar untuk **Lari**.
- **Geser Layar Kanan**: Putar kamera / arah pandang.
- **Tombol Kanan**: `Lompat`, `Jongkok` (untuk masuk ke bawah meja belajar), `Ambil / Lepas`, `Lempar`, dan `Saklar` (kipas angin / lampu pintu / jendela).
