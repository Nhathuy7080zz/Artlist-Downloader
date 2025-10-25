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

      const inputUrl = urlInput.value.trim();
      
      // Detect page type: SFX or Music
      const isSfxPage = currentUrl.startsWith('https://artlist.io/sfx') || 
                        (inputUrl && inputUrl.startsWith('https://artlist.io/sfx'));
      
      // Route to appropriate download handler
      if (isSfxPage) {
        await downloadSfx(currentUrl, inputUrl);
      } else {
        await downloadMusic(currentUrl, inputUrl);
      }

    } catch (error) {
      const t = translations[currentLang];
      showStatus(t.errorGeneral + error.message, 'error');
      setLoading(false);
    }
  });

  // Download Music (working version)
  async function downloadMusic(currentUrl, inputUrl) {
    const t = translations[currentLang];
    let audioInfo = null;

    // Simple approach like SFX: Get current/last played first
    audioInfo = await getCurrentPlaying();
    
    console.log('[Popup] Music Info:', audioInfo);

    // Strategy fallbacks only if no info at all
    if (!audioInfo) {
      // User provided specific Song URL
      if (inputUrl && inputUrl.includes('/song/')) {
        const songId = extractIdFromUrl(inputUrl);
        if (songId) {
          audioInfo = await getAudioInfo(songId, false);
        }
      }
      
      // Current page is specific Song
      if (!audioInfo && currentUrl.includes('/song/')) {
        const songId = extractIdFromUrl(currentUrl);
        if (songId) {
          audioInfo = await getAudioInfo(songId, false);
        }
      }
      
      // Last resort: scrape
      if (!audioInfo) {
        audioInfo = await getAnyAudioFromPage();
      }
    }

    if (!audioInfo) {
      showStatus(t.errorNoSong, 'error');
      setLoading(false);
      return;
    }

    // CRITICAL: If we have name but no URL, fetch URL using the ID
    if (audioInfo.songName && !audioInfo.sitePlayableFilePath && audioInfo.songId) {
      console.log('[Popup] Have name but no URL, fetching URL for ID:', audioInfo.songId);
      showStatus(t.statusGettingLink, 'info');
      const urlData = await getAudioInfo(audioInfo.songId, audioInfo.isSfx);
      if (urlData && urlData.sitePlayableFilePath) {
        // Merge: keep the good name, add the URL
        audioInfo.sitePlayableFilePath = urlData.sitePlayableFilePath;
        console.log('[Popup] ✅ Fetched URL:', urlData.sitePlayableFilePath);
      }
    }

    // If still no URL, wait and retry once
    if (!audioInfo.sitePlayableFilePath) {
      showStatus('Đợi audio load...', 'info');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const retry = await getCurrentPlaying();
      if (retry && retry.sitePlayableFilePath) {
        audioInfo = retry;
      }
    }

    // Final URL check
    if (!audioInfo.sitePlayableFilePath) {
      showStatus('Không có URL download. Hãy play nhạc trước!', 'error');
      setLoading(false);
      return;
    }

    console.log('[Popup] Downloading:', audioInfo.songName || 'Unknown');
    showStatus(t.statusDownloading, 'info');

    const filename = makeFilename(audioInfo);
    console.log('[Popup] Filename:', filename);
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
  }

  // Download SFX (separate handler)
  async function downloadSfx(currentUrl, inputUrl) {
    const t = translations[currentLang];
    let sfxInfo = null;

    // Simple approach: Just get current/last played
    // Content script already has the correct name from instant detection
    sfxInfo = await getCurrentPlaying();
    
    console.log('[Popup] SFX Info:', sfxInfo);

    // Strategy fallbacks only if no info at all
    if (!sfxInfo) {
      // User provided specific SFX URL
      if (inputUrl && inputUrl.includes('/sfx/') && !inputUrl.endsWith('/sfx')) {
        const sfxId = extractIdFromUrl(inputUrl);
        if (sfxId && !isNaN(sfxId)) {
          sfxInfo = await getAudioInfo(sfxId, true);
        }
      }
      
      // Current page is specific SFX
      if (!sfxInfo && currentUrl.includes('/sfx/') && !currentUrl.endsWith('/sfx')) {
        const sfxId = extractIdFromUrl(currentUrl);
        if (sfxId && !isNaN(sfxId)) {
          sfxInfo = await getAudioInfo(sfxId, true);
        }
      }
      
      // Last resort: scrape
      if (!sfxInfo) {
        sfxInfo = await getAnyAudioFromPage();
      }
    }

    if (!sfxInfo) {
      showStatus(t.errorNoSong, 'error');
      setLoading(false);
      return;
    }

    // CRITICAL: If we have name but no URL, fetch URL using the ID
    if (sfxInfo.songName && !sfxInfo.sitePlayableFilePath && sfxInfo.songId) {
      console.log('[Popup] Have name but no URL, fetching URL for ID:', sfxInfo.songId);
      const urlData = await getAudioInfo(sfxInfo.songId, sfxInfo.isSfx);
      if (urlData && urlData.sitePlayableFilePath) {
        // Merge: keep the good name, add the URL
        sfxInfo.sitePlayableFilePath = urlData.sitePlayableFilePath;
        console.log('[Popup] ✅ Fetched URL:', urlData.sitePlayableFilePath);
      }
    }

    // If still no URL, wait and retry once
    if (!sfxInfo.sitePlayableFilePath) {
      showStatus('Đợi audio load...', 'info');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const retry = await getCurrentPlaying();
      if (retry && retry.sitePlayableFilePath) {
        sfxInfo = retry;
      }
    }

    // Final URL check
    if (!sfxInfo.sitePlayableFilePath) {
      showStatus('Không có URL download. Hãy play SFX trước!', 'error');
      setLoading(false);
      return;
    }

    console.log('[Popup] Downloading:', sfxInfo.songName || 'Unknown');
    showStatus(t.statusDownloading, 'info');

    const filename = makeFilename(sfxInfo);
    console.log('[Popup] Filename:', filename);
    
    chrome.downloads.download({
      url: sfxInfo.sitePlayableFilePath,
      filename: filename,
      saveAs: false
    }, function(downloadId) {
      if (chrome.runtime.lastError) {
        showStatus(t.errorGeneral + chrome.runtime.lastError.message, 'error');
        setLoading(false);
      } else {
        showStatus(t.statusSuccess + (sfxInfo.songName || 'SFX'), 'success');
        setLoading(false);
      }
    });
  }

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
