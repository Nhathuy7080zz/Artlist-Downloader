# Tải nhạc và sound effects từ Artlist.io một cách dễ dàng và nhanh chóng.

## ✨ Tính năng

  - 🎧 **Tải nhạc & SFX**: Hỗ trợ cả Music và Sound Effects.
  - 🎯 **Tự động thông minh**: Chỉ cần 1 nút, tự động phát hiện bài đang phát hoặc bài hát trên trang bạn đang xem.
  - 📝 **Tên file gọn gàng**: Tự động đặt tên file theo định dạng `[Music] Artist - Song.aac` hoặc `[SFX] Artlist - Sound.aac`.
  - ⚡ **Nhanh & chất lượng**: Tải file AAC (định dạng gốc) chất lượng cao.

-----

## 🚀 Cài đặt

1.  **Tải project về máy**

      - Tải file ZIP và giải nén, hoặc clone repository bằng `git clone https://github.com/Nhathuy7080zz/Artlist-Downloader`.

2.  **Mở Extensions trong Chrome**

      - Vào `chrome://extensions/` trên thanh địa chỉ.
      - Hoặc vào Menu → More Tools → Extensions.

3.  **Bật Developer Mode**

      - Bật "Developer mode" (Chế độ nhà phát triển).

4.  **Load Extension**

      - Click nút "Load unpacked" (Tải tiện ích đã giải nén).
      - Chọn thư mục project bạn vừa giải nén (`artlist-downloader-v2.0`).
      - Extension sẽ xuất hiện trong danh sách.

-----

## 📖 Hướng dẫn sử dụng

**Đăng nhập vào [Artlist.io](https://artlist.io) (bắt buộc).**

### Cách 1: Tải bài đang phát

1.  Phát bất kỳ bài nhạc hoặc SFX nào.
2.  Mở.
3.  Click **"🎧 Tải xuống"** -> File sẽ được tải về.

### Cách 2: Tải từ link (Tùy chọn)

1.  Copy link của bài nhạc/SFX từ Artlist.
2.  Click icon extension.
3.  Paste link vào ô **"Link"**.
4.  Click **"🎧 Tải xuống"** -> File sẽ được tải về.

-----

## 🛠️ Cấu trúc dự án

```
artlist-downloader-v2.0/
├── manifest.json       # Cấu hình extension
├── background.js       # Background service worker
├── content.js          # Content script (detect và intercept data)
├── popup.html          # Giao diện popup
├── popup.js            # Logic xử lý popup
├── popup.css           # Styling cho popup
├── icon16.png          # Icon 16x16
├── icon48.png          # Icon 48x48
├── icon128.png         # Icon 128x128
└── README.md           # Tài liệu này
```

-----

## 🔧 Cách hoạt động

Extension sử dụng các kỹ thuật sau:

1.  **Content Script Injection**: Tiêm script vào trang Artlist để:
      - Giám sát trình phát audio (audio player).
      - Phát hiện bài hát/SFX đang phát.
      - Lấy thông tin (tên bài, nghệ sĩ) từ giao diện (UI).
2.  **XHR Interception**: Chặn và cache dữ liệu từ GraphQL API của Artlist để lấy link tải.
3.  **Chromium Downloads API**: Sử dụng API tải xuống của trình duyệt để lưu file AAC chất lượng cao.
4.  **Multi-method Detection**: Sử dụng 6 phương pháp dự phòng (fallback) để đảm bảo phát hiện chính xác bài hát.

-----

## 🐛 Troubleshooting

### Extension không hoạt động

  - Thử **đăng nhập vào Artlist**.
  - **Reload** lại trang Artlist (F5 hoặc Ctrl+R).
  - Thử tắt và bật lại extension trong trang `chrome://extensions/`.
  - Tải bản mới nhất

### Không tìm thấy bài hát/SFX

  - Nếu đang ở trang danh sách: **Phát một bài** trước khi bấm tải.
  - Nếu muốn tải bài cụ thể: **Mở trang chi tiết của bài đó**.
  - Reload lại trang và thử lại.

### File tải về bị lỗi

  - Kiểm tra **kết nối internet**.
  - Thử reload trang và tải lại.

-----

## 📝 Lưu ý

  - File tải về ở định dạng **AAC** (đây là định dạng gốc chất lượng cao từ Artlist).
  - Extension này được tạo cho mục đích học tập và **sử dụng cá nhân**. Vui lòng tuân thủ điều khoản sử dụng của Artlist.
  - Bạn phải phát audio ít nhất 1 lần để extension có thể "bắt" được link tải.

⚠️ **Disclaimer**: Mình không chịu trách nhiệm với bất kỳ vấn đề bản quyền nào khi bạn sử dụng công cụ này\!

-----

## 🤝 Đóng góp

Mọi đóng góp đều được hoan nghênh\! Vui lòng:

1.  Fork repository.
2.  Tạo branch mới (`git checkout -b feature/YourIdea`).
3.  Commit changes (`git commit -m 'Add YourIdea'`).
4.  Push to branch (`git push origin feature/YourIdea`).
5.  Mở Pull Request.

-----

Special Thanks to @xNasuni

**Enjoy\! 🎵**





