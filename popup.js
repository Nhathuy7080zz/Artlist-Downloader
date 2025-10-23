// Translations
const translations = {
  vi: {
    title: 'Artlist Downloader',
    subtitle: 'Tải nhạc từ Artlist.io',
    downloadBtn: '🎧 Tải nhạc',
    urlLabel: 'Link Artlist (tùy chọn):',
    infoText: '💡 Để trống để tải bài đang mở/phát, hoặc dán link để tải bài cụ thể',
    statusGettingInfo: 'Đang lấy thông tin bài hát...',
    statusGettingLink: 'Đang lấy link tải...',
    statusDownloading: 'Đang tải xuống...',
    statusSuccess: 'Đang tải: ',
    errorNoTab: 'Không tìm thấy tab. Vui lòng mở trang Artlist trước.',
    errorNotArtlist: 'Vui lòng mở trang Artlist trước khi sử dụng extension!',
    errorNoSong: 'Không tìm thấy bài hát. Vui lòng mở trang bài hát hoặc phát nhạc!',
    errorNoLink: 'Không thể lấy link tải! Vui lòng thử phát nhạc và thử lại.',
    errorRefresh: 'Không thể kết nối với trang. Vui lòng refresh trang!',
    errorGeneral: 'Lỗi: '
  },
  en: {
    title: 'Artlist Downloader',
    subtitle: 'Download music from Artlist.io',
    downloadBtn: '🎧 Download',
    urlLabel: 'Artlist Link (optional):',
    infoText: '💡 Leave blank to download current song, or paste link for specific song',
    statusGettingInfo: 'Getting song info...',
    statusGettingLink: 'Getting download link...',
    statusDownloading: 'Downloading...',
    statusSuccess: 'Downloading: ',
    errorNoTab: 'No tab found. Please open Artlist first.',
    errorNotArtlist: 'Please open Artlist before using this extension!',
    errorNoSong: 'No song found. Please open a song page or play music!',
    errorNoLink: 'Cannot get download link! Please try playing music first.',
    errorRefresh: 'Cannot connect to page. Please refresh the page!',
    errorGeneral: 'Error: '
  }
};

let currentLang = 'vi';

document.addEventListener('DOMContentLoaded', function() {
  const urlInput = document.getElementById('urlInput');
  const downloadBtn = document.getElementById('downloadBtn');
  const status = document.getElementById('status');
  const btnText = document.getElementById('btnText');
  const btnLoader = document.getElementById('btnLoader');
  const langToggle = document.getElementById('langToggle');
  const langText = document.getElementById('langText');

  // Load saved language
  chrome.storage.local.get(['language'], function(result) {
    if (result.language) {
      currentLang = result.language;
      updateLanguage();
    }
  });
  
  // Auto-fill URL from current tab
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentUrl = tabs[0].url;
    if (currentUrl && currentUrl.includes('artlist.io')) {
      urlInput.value = currentUrl;
    }
  });

  // Language toggle
  langToggle.addEventListener('click', function() {
    currentLang = currentLang === 'vi' ? 'en' : 'vi';
    chrome.storage.local.set({ language: currentLang });
    updateLanguage();
  });

  function updateLanguage() {
    const t = translations[currentLang];
    document.getElementById('subtitle').textContent = t.subtitle;
    document.getElementById('btnText').textContent = t.downloadBtn;
    document.getElementById('urlLabel').textContent = t.urlLabel;
    document.getElementById('infoText').textContent = t.infoText;
    langText.textContent = currentLang === 'vi' ? 'EN' : 'VI';
  }

  // Main download button - Smart logic
  downloadBtn.addEventListener('click', async function() {
    try {
      setLoading(true);
      const t = translations[currentLang];
      showStatus(t.statusGettingInfo, 'info');

      // Get current tab info
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        showStatus(t.errorNoTab, 'error');
        setLoading(false);
        return;
      }

      const currentUrl = tabs[0].url;
      if (!currentUrl || !currentUrl.includes('artlist.io')) {
        showStatus(t.errorNotArtlist, 'error');
        setLoading(false);
        return;
      }

      let songInfo = null;
      const inputUrl = urlInput.value.trim();

      // Strategy 0: If user provided URL in input, use that (highest priority)
      if (inputUrl && inputUrl.includes('artlist.io')) {
        console.log('📝 User provided URL, using that...');
        if (inputUrl.includes('/royalty-free-music/song/')) {
          const songId = extractSongIdFromUrl(inputUrl);
          songInfo = await getSongInfoViaContentScript(songId);
        }
      }

      // Strategy 1: If on a song page, download that song
      if (!songInfo && currentUrl.includes('/royalty-free-music/song/')) {
        console.log('📍 On song page, downloading this song...');
        const songId = extractSongIdFromUrl(currentUrl);
        songInfo = await getSongInfoViaContentScript(songId);
      }

      // Strategy 2: If no song from URL, try currently playing song
      if (!songInfo || !songInfo.sitePlayableFilePath) {
        console.log('🎵 Trying to get currently playing song...');
        songInfo = await getCurrentPlayingSong();
      }

      // Strategy 3: If still no song, try to get from page context
      if (!songInfo || !songInfo.sitePlayableFilePath) {
        console.log('🔍 Trying to scrape from page...');
        songInfo = await getAnySongFromPage();
      }

      if (!songInfo) {
        showStatus(t.errorNoSong, 'error');
        setLoading(false);
        return;
      }

      // If we have song info but no download link, fetch it
      if (!songInfo.sitePlayableFilePath && songInfo.songId) {
        showStatus(t.statusGettingLink, 'info');
        const fullSongInfo = await getSongInfoViaContentScript(songInfo.songId);
        
        if (fullSongInfo && fullSongInfo.sitePlayableFilePath) {
          songInfo = { ...songInfo, ...fullSongInfo };
        } else {
          showStatus(t.errorNoLink, 'error');
          setLoading(false);
          return;
        }
      }

      showStatus(t.statusDownloading, 'info');

      const filename = makeFilename(songInfo);
      const downloadUrl = songInfo.sitePlayableFilePath;

      if (!downloadUrl) {
        showStatus(t.errorNoLink, 'error');
        setLoading(false);
        return;
      }

      // Download file
      chrome.downloads.download({
        url: downloadUrl,
        filename: filename,
        saveAs: false
      }, function(downloadId) {
        if (chrome.runtime.lastError) {
          showStatus(t.errorGeneral + chrome.runtime.lastError.message, 'error');
          setLoading(false);
        } else {
          showStatus(t.statusSuccess + songInfo.songName, 'success');
          setLoading(false);
        }
      });

    } catch (error) {
      console.error('Error:', error);
      const t = translations[currentLang];
      showStatus(t.errorGeneral + error.message, 'error');
      setLoading(false);
    }
  });

  async function getCurrentPlayingSong() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs[0]) {
          resolve(null);
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'getCurrentSong'
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Content script error:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            console.log('No currently playing song');
            resolve(null);
          }
        });
      });
    });
  }

  async function getAnySongFromPage() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs[0]) {
          resolve(null);
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'getAnySong'
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Content script error:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            resolve(null);
          }
        });
      });
    });
  }

  function extractSongIdFromUrl(url) {
    const parts = url.split('/');
    return parts[parts.length - 1].split('?')[0];
  }

  async function getSongInfoViaContentScript(songId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs[0]) {
          reject(new Error('Không tìm thấy tab. Vui lòng mở trang Artlist trước.'));
          return;
        }
        
        // Kiểm tra xem có phải trang Artlist không
        if (!tabs[0].url || !tabs[0].url.includes('artlist.io')) {
          reject(new Error('Vui lòng mở trang Artlist trước khi sử dụng extension!'));
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'getSongInfo',
          songId: songId
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Content script error:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            console.error('Content script returned error:', response?.error);
            resolve(null);
          }
        });
      });
    });
  }

  function makeFilename(songData) {
    // Simple format: Artist - Song.aac
    const artist = sanitizeFilename(songData.artistName || 'Unknown');
    const song = sanitizeFilename(songData.songName || 'Unknown');
    return `${artist} - ${song}.aac`;
  }

  function sanitizeFilename(name) {
    // Remove invalid filename characters
    return name.replace(/[<>:"/\\|?*]/g, '').trim();
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = 'status ' + type;
    status.classList.remove('hidden');
  }

  function setLoading(loading) {
    downloadBtn.disabled = loading;
    if (loading) {
      btnText.classList.add('hidden');
      btnLoader.classList.remove('hidden');
    } else {
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
    }
  }
});
