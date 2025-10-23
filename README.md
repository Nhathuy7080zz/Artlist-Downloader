# 🎵 Artlist Music Downloader

Extension Chrome giúp tải nhạc từ Artlist.io một cách dễ dàng và nhanh chóng.

## ✨ Tính năng **(Chỉ có thể tải nhạc)**

- 🎧 **Tải bài đang phát**: Tải ngay bài hát đang phát trên Artlist chỉ với một cú click
- 🔗 **Tải từ link**: Nhập link bài hát Artlist để tải xuống
- 📝 **Tên file tự động**: File được đặt tên theo format `{Tên bài hát} - {Nghệ sĩ}.aac`
- ⚡ **Nhanh chóng**: Tải trực tiếp file âm thanh định dạng AAC chất lượng cao
- 🎯 **Đơn giản**: Giao diện thân thiện, dễ sử dụng
**Lưu ý: chỉ có thể tải nhạc và SFX**
## 📋 Yêu cầu

- Google Chrome hoặc các trình duyệt Chromium-based (Edge, Brave, Opera...)
- Tài khoản Artlist.io có quyền truy cập

## 🚀 Cài đặt

1. **Clone hoặc tải project về máy**
   ```bash
   git clone https://github.com/Nhathuy7080zz/Artlist-Downloader
   ```

2. **Mở Extensions**
   - Menu → More Tools → Extensions

3. **Bật Developer Mode**
   - Toggle nút "Developer mode" ở góc trên bên phải

4. **Load Extension**
   - Click "Load unpacked"
   - Chọn thư mục chứa project này
   - Extension sẽ xuất hiện trong danh sách

## 📖 Hướng dẫn sử dụng

### Phương pháp 1: Tải bài đang phát (Khuyến nghị)

1. Truy cập [Artlist.io](https://artlist.io)
2. Phát bài hát bạn muốn tải
3. Click vào icon extension trên toolbar
4. Click nút **"🎧 Tải bài đang phát"**
5. File sẽ được tải vềvề

### Phương pháp 2: Tải từ link

1. Truy cập trang bài hát trên Artlist (ví dụ: `https://artlist.io/royalty-free-music/song/abcxyz/123456`)
2. Click vào icon extension
3. Link sẽ tự động được điền vào ô input
4. Click **"Tải xuống"**
5. File sẽ được tải về

## 🛠️ Cấu trúc dự án

```
artlist-downloader/
├── manifest.json       # Cấu hình extension
├── background.js       # Background service worker
├── content.js          # Content script (intercept data từ Artlist)
├── popup.html          # Giao diện popup
├── popup.js            # Logic xử lý popup
├── popup.css           # Styling cho popup
├── icon16.png          # Icon 16x16
├── icon48.png          # Icon 48x48
├── icon128.png         # Icon 128x128
└── README.md           # Tài liệu này
```

## 🔧 Cách hoạt động

Extension sử dụng các kỹ thuật sau:

1. **Content Script Injection**: Inject script vào trang Artlist để:
   - Monitor audio player
   - Detect bài hát đang phát
   - Lấy thông tin từ UI

2. **XHR Interception**: Chặn và cache data từ API requests của Artlist

3. **Chromium Downloads API**: Tải file trực tiếp sử dụng Chromium Downloads API

## 🐛 Troubleshooting

### Extension không hoạt động
- Reload lại trang Artlist
- Thử tắt và bật lại extension
- Tải bản mới nhất

### Không tìm thấy bài đang phát
- Đảm bảo bài hát đang được phát (không pause)
- Reload lại trang và phát lại bài hát
- Thử sử dụng phương pháp "Tải từ link"

### File tải về bị lỗi
- Kiểm tra kết nối internet
- Thử tải lại

## 📝 Lưu ý
- File tải về ở định dạng AAC
- Chỉ sử dụng cho mục đích cá nhân và tuân thủ điều khoản sử dụng của Artlist
- Mình không chịu trách nhiệm với bất kì vấn đề nào với bản quyền sử dụng nhạc khi bạn tải nhạc từ công cụ của mình!

## 📄 License
Dự án này được tạo cho mục đích học tập và sử dụng cá nhân.

## 🤝 Đóng góp

Mọi đóng góp đều được hoan nghênh! Vui lòng:
1. Fork repository
2. Tạo branch mới (`git checkout -b feature/YourIdea`)
3. Commit changes (`git commit -m 'Add some YourIdea'`)
4. Push to branch (`git push origin feature/YourIdea`)
5. Mở Pull Request

## 📧 Liên hệ

Nếu có bất kỳ câu hỏi hoặc góp ý nào, vui lòng tạo issue trên GitHub.
