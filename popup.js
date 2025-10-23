// Popup.js - Artlist Downloader v3 (Music + SFX Support)

const translations = {
  vi: {
    title: 'Artlist Downloader',
    subtitle: 'Tải Music & Sound Effects',
    downloadBtn: '🎧 Tải xuống',
    urlLabel: 'Link (tùy chọn):',
    statusGettingInfo: 'Đang lấy thông tin...',
    statusGettingLink: 'Đang lấy link tải...',
    statusDownloading: 'Đang tải xuống...',
    statusSuccess: 'Đang tải: ',
    errorNoTab: 'Không tìm thấy tab.',
    errorNotArtlist: 'Vui lòng mở trang Artlist!',
    errorNoSong: 'Không tìm thấy audio. Vui lòng phát nhạc/SFX!',
    errorNoLink: 'Không thể lấy link tải!',
    errorGeneral: 'Lỗi: '
  },
  en: {
    title: 'Artlist Downloader',
    subtitle: 'Download Music & Sound Effects',
    downloadBtn: '🎧 Download',
    urlLabel: 'Link (optional):',
    statusGettingInfo: 'Getting info...',
    statusGettingLink: 'Getting download link...',
    statusDownloading: 'Downloading...',
    statusSuccess: 'Downloading: ',
    errorNoTab: 'No tab found.',
    errorNotArtlist: 'Please open Artlist first!',
    errorNoSong: 'No audio found. Please play music/SFX!',
    errorNoLink: 'Cannot get download link!',
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
  
  // Auto-fill URL
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
    langText.textContent = currentLang === 'vi' ? 'EN' : 'VI';
  }

  // Main download logic
  downloadBtn.addEventListener('click', async function() {
    try {
      setLoading(true);
      const t = translations[currentLang];
      showStatus(t.statusGettingInfo, 'info');

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

      let audioInfo = null;
      const inputUrl = urlInput.value.trim();
      const isSfx = currentUrl.includes('/sound-effects/') || currentUrl.includes('/sfx/') ||
                     inputUrl.includes('/sound-effects/') || inputUrl.includes('/sfx/');

      // Strategy 0: User provided URL
      if (inputUrl && inputUrl.includes('artlist.io')) {
        if (inputUrl.includes('/song/')) {
          const songId = extractIdFromUrl(inputUrl);
          audioInfo = await getAudioInfo(songId, false);
        } else if (inputUrl.includes('/sfx/')) {
          const sfxId = extractIdFromUrl(inputUrl);
          audioInfo = await getAudioInfo(sfxId, true);
        }
      }

      // Strategy 1: Current page
      if (!audioInfo) {
        if (currentUrl.includes('/song/')) {
          const songId = extractIdFromUrl(currentUrl);
          audioInfo = await getAudioInfo(songId, false);
        } else if (currentUrl.includes('/sfx/')) {
          const sfxId = extractIdFromUrl(currentUrl);
          audioInfo = await getAudioInfo(sfxId, true);
        }
      }

      // Strategy 2: Currently playing
      if (!audioInfo || !audioInfo.sitePlayableFilePath) {
        audioInfo = await getCurrentPlaying();
      }

      // Strategy 3: Scrape from page
      if (!audioInfo || !audioInfo.sitePlayableFilePath) {
        audioInfo = await getAnyAudioFromPage();
      }

      if (!audioInfo) {
        showStatus(t.errorNoSong, 'error');
        setLoading(false);
        return;
      }

      // If missing download link, fetch it
      if (!audioInfo.sitePlayableFilePath && audioInfo.songId) {
        showStatus(t.statusGettingLink, 'info');
        const fullInfo = await getAudioInfo(audioInfo.songId, audioInfo.isSfx || false);
        
        if (fullInfo && fullInfo.sitePlayableFilePath) {
          audioInfo = { ...audioInfo, ...fullInfo };
        } else {
          showStatus(t.errorNoLink, 'error');
          setLoading(false);
          return;
        }
      }

      showStatus(t.statusDownloading, 'info');

      const filename = makeFilename(audioInfo);
      const downloadUrl = audioInfo.sitePlayableFilePath;

      if (!downloadUrl) {
        showStatus(t.errorNoLink, 'error');
        setLoading(false);
        return;
      }

      // Download
      chrome.downloads.download({
        url: downloadUrl,
        filename: filename,
        saveAs: false
      }, function(downloadId) {
        if (chrome.runtime.lastError) {
          showStatus(t.errorGeneral + chrome.runtime.lastError.message, 'error');
          setLoading(false);
        } else {
          showStatus(t.statusSuccess + audioInfo.songName, 'success');
          setLoading(false);
        }
      });

    } catch (error) {
      const t = translations[currentLang];
      showStatus(t.errorGeneral + error.message, 'error');
      setLoading(false);
    }
  });

  async function getAudioInfo(id, isSfx) {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs[0]) {
          resolve(null);
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: isSfx ? 'getSfxInfo' : 'getSongInfo',
          [isSfx ? 'sfxId' : 'songId']: id
        }, function(response) {
          if (chrome.runtime.lastError || !response || !response.success) {
            resolve(null);
            return;
          }
          resolve(response.data);
        });
      });
    });
  }

  async function getCurrentPlaying() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs[0]) {
          resolve(null);
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'getCurrentSong'
        }, function(response) {
          if (chrome.runtime.lastError || !response || !response.success) {
            resolve(null);
            return;
          }
          resolve(response.data);
        });
      });
    });
  }

  async function getAnyAudioFromPage() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs[0]) {
          resolve(null);
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'getAnySong'
        }, function(response) {
          if (chrome.runtime.lastError || !response || !response.success) {
            resolve(null);
            return;
          }
          resolve(response.data);
        });
      });
    });
  }

  function extractIdFromUrl(url) {
    const parts = url.split('/');
    return parts[parts.length - 1].split('?')[0];
  }

  function makeFilename(audioData) {
    const artist = sanitizeFilename(audioData.artistName || 'Artlist');
    const name = sanitizeFilename(audioData.songName || 'Unknown');
    const prefix = audioData.isSfx ? 'SFX' : 'Music';
    
    // Format: [SFX/Music] Artist - Name.aac
    return `[${prefix}] ${artist} - ${name}.aac`;
  }

  function sanitizeFilename(name) {
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
