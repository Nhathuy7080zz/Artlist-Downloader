# 🎵 Artlist Downloader v2.0# 🎵 Artlist Downloader# 🎵 Artlist Downloader v3 - Production Edition# 🎵 Artlist Music Downloader



Extension Chrome giúp tải **nhạc** và **sound effects** từ Artlist.io một cách dễ dàng và nhanh chóng.



## ✨ Tính năngExtension giúp tải **nhạc** và **sound effects** từ Artlist.io một cách dễ dàng và nhanh chóng.



- 🎧 **Tải nhạc & SFX**: Hỗ trợ cả Music và Sound Effects

- 🎯 **Tự động thông minh**: Chỉ cần 1 nút, tự động phát hiện bài đang phát

- 📝 **Tên file gọn gàng**: `[Music] Artist - Song.aac` hoặc `[SFX] Artlist - Sound.aac`

- ⚡ **Nhanh & chất lượng**: File AAC chất lượng cao



## 📋 Yêu cầu- 🎧 **Tải nhạc & SFX**: Hỗ trợ cả Music và Sound Effects



- Google Chrome hoặc trình duyệt Chromium (Edge, Brave, Opera...)- 🎯 **Tự động thông minh**: Chỉ cần 1 nút, tự động phát hiện bài đang phát

- 📝 **Tên file gọn gàng**: `[Music] Artist - Song.aac` hoặc `[SFX] Artlist - Sound.aac`

## 🚀 Cài đặt

- ⚡ **Nhanh & chất lượng**: File AAC chất lượng cao

1. **Tải project về máy**

   - Download ZIP hoặc clone repository

   - Giải nén

## 📋 Yêu cầu- ✅ **Download Music** - High quality AAC format- 🎧 **Tải nhạc thông minh**: Tự động phát hiện bài hát từ trang đang mở hoặc bài đang phát

2. **Mở Extensions trong Chrome**

   - Vào `chrome://extensions/`

   - Hoặc Menu → More Tools → Extensions

- Chromium-based Browser (Edge, Brave, Opera...)- ✅ **Download Sound Effects** - Full SFX library support- 🌐 **Đa ngôn ngữ**: Hỗ trợ tiếng Việt và tiếng Anh, chuyển đổi dễ dàng qua nút toggl

3. **Bật Developer Mode**

   - Toggle nút "Developer mode" ở góc trên bên phải- ✅ **Auto-detect Playing Audio** - Automatically detects what's currently playing- 📝 **Tên file gọn gàng**: Format đơn giản `{Nghệ sĩ} - {Tên bài}.aac`



4. **Load Extension**## 🚀 Cài đặt

   - Click "Load unpacked"

   - Chọn thư mục `artlist-downloader-v2.0`- ✅ **Smart Fallback** - Multiple detection methods for maximum reliability- ⚡ **Nhanh chóng**: Tải trực tiếp file âm thanh định dạng AAC chất lượng cao

   - Extension sẽ xuất hiện trong danh sách

1. **Clone hoặc tải project về máy**

## 📖 Hướng dẫn sử dụng

   ```bash- ✅ **Bilingual** - Vietnamese & English interface- 🎯 **Cực kỳ đơn giản**: Chỉ cần 1 nút, không cần nhập link thủ công

### Cách 1: Tải bài đang phát (Dễ nhất)

   git clone https://github.com/Nhathuy7080zz/Artlist-Downloader

1. Vào [Artlist.io](https://artlist.io)

2. Phát bất kỳ bài nhạc hoặc SFX nào   ```- ✅ **Clean & Fast** - No console spam, optimized performance

3. Click icon extension trên toolbar

4. Click nút **"🎧 Tải xuống"**

5. ✅ Xong! File tự động tải về

2. **Mở Extensions trong Chrome**- ✅ **Zero Configuration** - Just install and use**Lưu ý**: Extension chỉ hỗ trợ tải nhạc và SFX, không hỗ trợ video

### Cách 2: Tải từ trang bài hát

   - Vào `chrome://extensions/`

1. Mở trang bất kỳ bài nhạc/SFX trên Artlist  

   Ví dụ: `https://artlist.io/royalty-free-music/song/bring-it-on/116235`   - Hoặc Menu → More Tools → Extensions## 📋 Yêu cầu

2. Click icon extension

3. Click **"🎧 Tải xuống"**

4. Extension tự động nhận diện và tải

3. **Bật Developer Mode**## 🚀 Installation

### Cách 3: Tải từ link (Tùy chọn)

   - Toggle nút "Developer mode" ở góc trên bên phải

1. Copy link bài nhạc/SFX từ Artlist

2. Click icon extension- Google Chrome hoặc các trình duyệt Chromium-based (Edge, Brave, Opera...)

3. Paste vào ô **"Link (optional)"**

4. Click **"🎧 Tải xuống"**4. **Load Extension**

## 🛠️ Cấu trúc dự án



```

artlist-downloader-v2.0/## 📖 Hướng dẫn sử dụng3. Enable "Developer mode" (top right)## 🚀 Cài đặt

├── manifest.json       # Cấu hình extension

├── background.js       # Background service worker

├── content.js          # Content script (detect và intercept data)

├── popup.html          # Giao diện popup### Cách 1: Tải bài đang phát (Dễ nhất)4. Click "Load unpacked"

├── popup.js            # Logic xử lý popup

├── popup.css           # Styling cho popup

├── icon16.png          # Icon 16x16

├── icon48.png          # Icon 48x481. Vào [Artlist.io](https://artlist.io)5. Select the `v3-improved` folder1. **Clone hoặc tải project về máy**

├── icon128.png         # Icon 128x128

└── README.md           # Tài liệu này2. Phát bất kỳ bài nhạc hoặc SFX nào

```

3. Click icon extension trên toolbar   ```bash

## 🔧 Cách hoạt động

4. Click nút **"🎧 Tải xuống"**

Extension sử dụng các kỹ thuật sau:

5. ✅ Xong! File tự động tải về## 📖 How to Use   git clone https://github.com/Nhathuy7080zz/Artlist-Downloader

1. **Content Script Injection**: Inject script vào trang Artlist để:

   - Monitor audio player

   - Detect bài hát/SFX đang phát

   - Lấy thông tin từ UI### Cách 2: Tải từ trang bài hát   ```



2. **XHR Interception**: Chặn và cache data từ GraphQL API của Artlist



3. **Chromium Downloads API**: Tải file trực tiếp với định dạng AAC chất lượng cao1. Mở trang bất kỳ bài nhạc/SFX trên Artlist  ### Method 1: Auto-detect (Easiest)



4. **Multi-method Detection**: Sử dụng 6 phương pháp fallback để đảm bảo phát hiện chính xác   Ví dụ: `https://artlist.io/royalty-free-music/song/bring-it-on/116235`



## 📌 Phiên bản2. Click icon extension1. Go to [Artlist.io](https://artlist.io)2. **Mở Extensions**



**v2.0** (October 2025) - Production Ready3. Click **"🎧 Tải xuống"**

- ✅ **NEW**: Hỗ trợ Sound Effects (SFX)

- ✅ **NEW**: Đa ngôn ngữ Việt/Anh4. Extension tự động nhận diện và tải2. Play any music or sound effect   - Menu → More Tools → Extensions

- ✅ **FIX**: Phát hiện chính xác bài đang phát

- ✅ **IMPROVE**: Giao diện compact, gọn gàng

- ✅ **IMPROVE**: Tắt debug logs, tối ưu performance

- ✅ **IMPROVE**: Tên file rõ ràng với prefix [Music]/[SFX]### Cách 3: Tải từ link (Tùy chọn)3. Click the extension icon



## 🐛 Troubleshooting



### Extension không hoạt động1. Copy link bài nhạc/SFX từ Artlist4. Click "Download" - that's it!3. **Bật Developer Mode**

- Đảm bảo đã **đăng nhập Artlist**

- **Reload** lại trang Artlist (F5)2. Click icon extension

- Thử tắt và bật lại extension

3. Paste vào ô **"Link (optional)"**   - Toggle nút "Developer mode" ở góc trên bên phải

### Không tìm thấy bài hát/SFX

- Nếu đang ở trang danh sách: **Phát một bài** trước4. Click **"🎧 Tải xuống"**

- Nếu muốn tải bài cụ thể: **Mở trang bài đó**

- Reload trang và thử lại### Method 2: Direct Link



### File tải về bị lỗi### 🌐 Chuyển đổi ngôn ngữ

- Kiểm tra **kết nối internet**

- Đảm bảo **tài khoản Artlist còn hiệu lực**1. Copy the URL of any song or SFX from Artlist4. **Load Extension**

- Thử reload trang và tải lại

- Click nút **VI/EN** ở góc trên để chuyển giữa tiếng Việt và English

## 📝 Lưu ý

- Ngôn ngữ được lưu tự động2. Click the extension icon   - Click "Load unpacked"

- File tải về ở định dạng **AAC** (định dạng gốc của Artlist)

- Chỉ sử dụng cho **mục đích cá nhân** và tuân thủ điều khoản của Artlist

- Link tải có thể hết hạn sau vài giờ

- Phải phát audio ít nhất 1 lần để extension phát hiện URL## 🛠️ Cấu trúc dự án3. Paste the URL in the input field   - Chọn thư mục chứa project này



⚠️ **Disclaimer**: Mình không chịu trách nhiệm với bất kỳ vấn đề bản quyền nào khi bạn sử dụng công cụ này!



## 🤝 Đóng góp```4. Click "Download"   - Extension sẽ xuất hiện trong danh sách



Mọi đóng góp đều được hoan nghênh! Vui lòng:v3-improved/

1. Fork repository

2. Tạo branch mới (`git checkout -b feature/YourIdea`)├── manifest.json       # Cấu hình extension

3. Commit changes (`git commit -m 'Add YourIdea'`)

4. Push to branch (`git push origin feature/YourIdea`)├── background.js       # Background service worker

5. Mở Pull Request

├── content.js          # Content script (detect và intercept data)### Method 3: Page Context## 📖 Hướng dẫn sử dụng

## 📄 License

├── popup.html          # Giao diện popup

MIT License - Dự án này được tạo cho mục đích học tập và sử dụng cá nhân.

├── popup.js            # Logic xử lý popup1. Open any song/SFX page on Artlist

---

├── popup.css           # Styling cho popup

**Enjoy your music! 🎵**

├── icon16.png          # Icon 16x162. Click the extension iconExtension hoạt động **tự động thông minh**, chỉ cần 1 nút bấm!

├── icon48.png          # Icon 48x48

├── icon128.png         # Icon 128x1283. Click "Download" (works even if not playing)

└── README.md           # Tài liệu này

```### Cách 1: Tải từ trang bài hát (Dễ nhất)



## 🔧 Cách hoạt động## 🎯 Supported URLs



Extension sử dụng các kỹ thuật sau:1. Mở trang bài hát trên Artlist (ví dụ: `https://artlist.io/royalty-free-music/song/bring-it-on/116235`)



1. **Content Script Injection**: Inject script vào trang Artlist để:- Music: `https://artlist.io/royalty-free-music/song/...`2. Click icon extension trên toolbar

   - Monitor audio player

   - Detect bài hát/SFX đang phát- Sound Effects: `https://artlist.io/sfx/...`3. Click nút **"🎧 Tải nhạc"**

   - Lấy thông tin từ UI

- Albums, playlists, and browse pages (auto-detects playing audio)4. Extension tự động tải bài hát đó

2. **XHR Interception**: Chặn và cache data từ GraphQL API của Artlist



3. **Chromium Downloads API**: Tải file trực tiếp với định dạng AAC chất lượng cao

## 📁 File Naming### Cách 2: Tải bài đang phát

4. **Multi-method Detection**: Sử dụng 6 phương pháp fallback để đảm bảo phát hiện chính xác



## 📌 Phiên bản

Downloaded files are automatically named in this format:1. Phát bất kỳ bài hát nào trên Artlist

**v3.0.0** (October 2025) - Production Ready

- ✅ **NEW**: Hỗ trợ Sound Effects (SFX)2. Click icon extension

- ✅ **NEW**: Đa ngôn ngữ Việt/Anh

- ✅ **FIX**: Phát hiện chính xác bài đang phát- **Music**: `[Music] Artist Name - Song Title.aac`3. Click nút **"🎧 Tải nhạc"**

- ✅ **IMPROVE**: Giao diện compact, gọn gàng

- ✅ **IMPROVE**: Tắt debug logs, tối ưu performance- **Sound Effects**: `[SFX] Artlist - Sound Name.aac`4. Extension tự động phát hiện và tải bài đang phát

- ✅ **IMPROVE**: Tên file rõ ràng với prefix [Music]/[SFX]



**v2.0.0**

- ✅ Thêm tính năng tải bài đang phát## 🔧 Technical Details### 🌐 Chuyển đổi ngôn ngữ

- ✅ Manifest V3



## 🐛 Troubleshooting

- **Architecture**: Chrome Extension Manifest V3- Click nút **VI/EN** ở góc trên bên phải để chuyển đổi giữa tiếng Việt và tiếng Anh

### Extension không hoạt động

- Đảm bảo đã **đăng nhập Artlist**- **Content Script**: Monitors audio elements and intercepts API calls- Ngôn ngữ được lưu tự động cho lần sử dụng sau

- **Reload** lại trang Artlist (F5)

- Thử tắt và bật lại extension- **Detection Methods**:



### Không tìm thấy bài hát/SFX  1. Player bar detection## 🛠️ Cấu trúc dự án

- Nếu đang ở trang danh sách: **Phát một bài** trước

- Nếu muốn tải bài cụ thể: **Mở trang bài đó**  2. Audio element + URL matching

- Reload trang và thử lại

  3. Modal/dialog detection```

### File tải về bị lỗi

- Kiểm tra **kết nối internet**  4. Table pause button detectionartlist-downloader/

- Đảm bảo **tài khoản Artlist còn hiệu lực**

- Thử reload trang và tải lại  5. Page metadata extraction├── manifest.json       # Cấu hình extension



## 📝 Lưu ý  6. GraphQL API fallback├── background.js       # Background service worker



- File tải về ở định dạng **AAC** (định dạng gốc của Artlist)├── content.js          # Content script (intercept data từ Artlist)

- Chỉ sử dụng cho **mục đích cá nhân** và tuân thủ điều khoản của Artlist

- Link tải có thể hết hạn sau vài giờ## 🛠️ Development├── popup.html          # Giao diện popup

- Phải phát audio ít nhất 1 lần để extension phát hiện URL

├── popup.js            # Logic xử lý popup

⚠️ **Disclaimer**: Mình không chịu trách nhiệm với bất kỳ vấn đề bản quyền nào khi bạn sử dụng công cụ này!

To enable debug logging, edit `content.js` and set:├── popup.css           # Styling cho popup

## 🤝 Đóng góp

```javascript├── icon16.png          # Icon 16x16

Mọi đóng góp đều được hoan nghênh! Vui lòng:

1. Fork repositoryconst DEBUG = true; // Line 4├── icon48.png          # Icon 48x48

2. Tạo branch mới (`git checkout -b feature/YourIdea`)

3. Commit changes (`git commit -m 'Add YourIdea'`)```├── icon128.png         # Icon 128x128

4. Push to branch (`git push origin feature/YourIdea`)

5. Mở Pull Request└── README.md           # Tài liệu này



## 📄 License## 📝 Changelog```



MIT License - Dự án này được tạo cho mục đích học tập và sử dụng cá nhân.



---### v3.0 (Current)## 🔧 Cách hoạt động



**Enjoy your music! 🎵**- ✅ Added Sound Effects support


- ✅ Removed all console logging (production mode)Extension sử dụng các kỹ thuật sau:

- ✅ Improved detection reliability

- ✅ Added concurrent detection protection1. **Content Script Injection**: Inject script vào trang Artlist để:

- ✅ Better filename formatting   - Monitor audio player

- ✅ Optimized performance   - Detect bài hát đang phát

   - Lấy thông tin từ UI

## ⚠️ Notes

2. **XHR Interception**: Chặn và cache data từ API requests của Artlist

- You must be logged in to Artlist.io

- Audio must be played at least once for URL detection3. **Chromium Downloads API**: Tải file trực tiếp sử dụng Chromium Downloads API

- Some download links expire after a few hours

- Files are in AAC format (Artlist's native format)## � Phiên bản



## 📄 License**v3.0.0** (Current - October 2025)

- ✅ **FIX**: Sửa lỗi không tải đúng bài đang phát (detect chính xác từ player bar)

MIT License - Feel free to use and modify- ✅ **NEW**: Gộp thành 1 nút thông minh, tự động detect context

- ✅ **NEW**: Thêm hỗ trợ đa ngôn ngữ (Tiếng Việt/English)

## 🙏 Credits- ✅ **IMPROVE**: Tên file ngắn gọn hơn: `{Artist} - {Song}.aac`

- ✅ **IMPROVE**: UX tốt hơn với info text hướng dẫn

Created for personal use. Artlist.io is a trademark of Artlist Ltd.

**v2.0.0** 

---- ✅ Thêm tính năng tải bài đang phát

- ✅ Manifest V3

**Enjoy your music! 🎵**

## �🐛 Troubleshooting

### Extension không hoạt động
- Đảm bảo đã **đăng nhập Artlist**
- **Reload** lại trang Artlist (F5)
- Thử tắt và bật lại extension

### Không tìm thấy bài hát
- Nếu đang ở trang danh sách: **Phát một bài hát** trước
- Nếu muốn tải bài cụ thể: **Mở trang bài hát đó**
- Reload trang và thử lại

### File tải về bị lỗi
- Kiểm tra **kết nối internet**
- Đảm bảo **tài khoản Artlist còn hiệu lực**
- Thử reload trang và tải lại

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