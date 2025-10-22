// Background service worker cho extension
// Lắng nghe các sự kiện từ popup

chrome.runtime.onInstalled.addListener(() => {
  console.log('Artlist Downloader Extension installed!');
});

// Xử lý download hoàn tất
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    console.log('Download completed:', delta.id);
  }
  
  if (delta.error) {
    console.error('Download error:', delta.error);
  }
});
