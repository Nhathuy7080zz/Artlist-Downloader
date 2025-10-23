// Content script để inject vào trang Artlist và lấy dữ liệu
// PHƯƠNG PHÁP: Intercept XHR + Detect playing song

console.log('Artlist Downloader - content script loaded');

// Storage cho cached data từ XHR intercept
const cachedSongsData = [];
const cachedSfxData = [];

// Storage cho current playing song
let currentPlayingSong = null;
let isDetecting = false; // Flag to prevent concurrent detection
let lastDetectionTime = 0; // Timestamp of last detection

// Detect bài hát đang phát
function detectCurrentSong() {
  // Debounce: không detect nếu vừa detect trong vòng 1 giây
  const now = Date.now();
  if (now - lastDetectionTime < 1000) {
    console.log('⏭️ Skipping detection (too soon)');
    return;
  }
  
  // Prevent concurrent detection
  if (isDetecting) {
    console.log('⏭️ Detection already in progress');
    return;
  }
  
  isDetecting = true;
  lastDetectionTime = now;
  
  try {
    console.log('🔍 Detecting current song...');
    const songInfo = extractSongInfoFromUI();
    
    if (!songInfo) {
      console.log('❌ No song info extracted from UI');
      return;
    }
    
    console.log('✅ Song info extracted:', songInfo);
    
    let audioUrl = '';
    const audioElement = document.querySelector('audio');
    if (audioElement) {
      audioUrl = audioElement.currentSrc || audioElement.src || '';
      console.log('🎵 Audio URL:', audioUrl);
    } else {
      console.log('⚠️ No audio element found');
    }
    
    currentPlayingSong = {
      ...songInfo,
      sitePlayableFilePath: audioUrl,
      detectedAt: Date.now()
    };
    
    console.log('💾 Current playing song saved:', currentPlayingSong);
  } catch (error) {
    console.error('❌ Error detecting current song:', error);
  } finally {
    isDetecting = false;
  }
}

// Monitor audio element để detect bài hát đang phát
function monitorAudioPlayer() {
  console.log('🎧 Starting audio player monitor...');
  
  let audioElement = null;
  let isMonitoring = false;
  
  const setupAudioMonitoring = (audio) => {
    if (isMonitoring) return;
    isMonitoring = true;
    
    console.log('🎵 Setting up audio monitoring...');
    
    // Lắng nghe khi bài hát được play
    audio.addEventListener('play', function() {
      console.log('▶️ Song started playing');
      setTimeout(() => detectCurrentSong(), 500); // Delay 500ms để UI update
    });
    
    // Lắng nghe khi src thay đổi
    audio.addEventListener('loadeddata', function() {
      console.log('📥 Audio loaded:', audio.src);
      setTimeout(() => detectCurrentSong(), 500);
    });
    
    // Lắng nghe khi timeupdate (bài đang phát)
    let lastCheck = 0;
    audio.addEventListener('timeupdate', function() {
      const now = Date.now();
      if (now - lastCheck > 5000) { // Check mỗi 5 giây
        lastCheck = now;
        detectCurrentSong();
      }
    });
    
    // Observer để theo dõi attribute changes
    const observer = new MutationObserver(() => {
      if (audio.src && audio.currentSrc) {
        console.log('🔄 Audio source changed:', audio.src);
        setTimeout(() => detectCurrentSong(), 500);
      }
    });
    
    observer.observe(audio, { 
      attributes: true, 
      attributeFilter: ['src', 'currentSrc'] 
    });
  };
  
  // Continuous check for audio element
  const checkAudio = () => {
    const audio = document.querySelector('audio');
    if (audio && audio !== audioElement) {
      audioElement = audio;
      isMonitoring = false;
      console.log('🎵 Found audio element!');
      setupAudioMonitoring(audio);
      
      // Detect ngay lập tức nếu đang phát
      if (!audio.paused) {
        setTimeout(() => detectCurrentSong(), 1000);
      }
    }
  };
  
  // Check ngay lập tức
  checkAudio();
  
  // Check định kỳ mỗi 2 giây
  setInterval(checkAudio, 2000);
  
  // Detect khi trang load xong
  if (document.readyState === 'complete') {
    setTimeout(() => detectCurrentSong(), 2000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => detectCurrentSong(), 2000);
    });
  }
}

// Extract thông tin bài hát từ UI (player đang phát)
function extractSongInfoFromUI() {
  try {
    let songName = '';
    let artistName = '';
    let songId = '';
    
    // METHOD 1: Tìm từ player bar ở bottom (chính xác nhất)
    // Thử nhiều selector khác nhau vì Artlist thường thay đổi class names
    const playerBar = document.querySelector('[data-testid="MusicPlayer"]') || 
                      document.querySelector('[data-testid="AudioPlayer"]') ||
                      document.querySelector('[class*="MusicPlayer"]') ||
                      document.querySelector('[class*="AudioPlayer"]') ||
                      document.querySelector('[class*="player" i]:has(audio)') ||
                      document.querySelector('div[class*="Player" i]:has(audio)') ||
                      document.querySelector('footer:has(audio)') ||
                      document.querySelector('div[role="region"]:has(audio)');
    
    if (playerBar) {
      console.log('🎯 Found player bar element:', playerBar);
      
      // Thử tìm tất cả các link trong player bar
      const allLinks = playerBar.querySelectorAll('a[href*="/song/"]');
      console.log('Found links in player:', allLinks.length);
      
      const songLink = allLinks[0]; // Lấy link đầu tiên
      const artistLink = playerBar.querySelector('a[href*="/artist/"]');
      
      if (songLink) {
        songName = songLink.textContent?.trim() || songLink.innerText?.trim() || '';
        const href = songLink.getAttribute('href') || '';
        const parts = href.split('/');
        songId = parts[parts.length - 1].split('?')[0];
        console.log('Found songName:', songName, 'songId:', songId);
      }
      
      if (artistLink) {
        artistName = artistLink.textContent?.trim() || artistLink.innerText?.trim() || '';
        console.log('Found artistName:', artistName);
      }
      
      if (songName) {
        console.log('✅ Found song from player bar:', songName);
        return {
          songId: songId || 'unknown',
          songName: songName,
          artistId: '',
          artistName: artistName || 'Unknown Artist',
          albumId: '',
          albumName: songName
        };
      }
    } else {
      console.log('❌ Player bar not found, trying alternative methods...');
    }
    
    // METHOD 2: Tìm từ audio element và match với URL
    const audioElement = document.querySelector('audio');
    if (audioElement && audioElement.src) {
      console.log('🎵 Found audio element with src:', audioElement.src);
      
      // Extract song ID from audio URL if possible
      const audioUrl = audioElement.src;
      const urlMatch = audioUrl.match(/\/(\d+)\./);
      if (urlMatch) {
        const possibleSongId = urlMatch[1];
        console.log('Extracted possible song ID from audio:', possibleSongId);
        
        // Try to find corresponding link on page
        const possibleLink = document.querySelector(`a[href*="/song/${possibleSongId}"]`);
        if (possibleLink) {
          songName = possibleLink.textContent?.trim() || possibleLink.innerText?.trim() || '';
          songId = possibleSongId;
          console.log('✅ Matched audio to song link:', songName);
        }
      }
    }
    
    // METHOD 3: Check if we're in album/modal view with detail opened
    const modal = document.querySelector('[role="dialog"]') || 
                  document.querySelector('[data-testid="Modal"]') ||
                  document.querySelector('[class*="Modal" i]');
    
    if (modal) {
      console.log('🎯 Found modal, extracting from modal...');
      const songLink = modal.querySelector('a[href*="/song/"]');
      const artistLink = modal.querySelector('a[href*="/artist/"]');
      
      if (songLink) {
        songName = songLink.textContent?.trim() || songLink.innerText?.trim() || '';
        const href = songLink.getAttribute('href') || '';
        const parts = href.split('/');
        songId = parts[parts.length - 1].split('?')[0];
      }
      
      if (artistLink) {
        artistName = artistLink.textContent?.trim() || artistLink.innerText?.trim() || '';
      }
      
      if (songName) {
        console.log('✅ Found song from modal:', songName);
        return {
          songId: songId || 'unknown',
          songName: songName,
          artistId: '',
          artistName: artistName || 'Unknown Artist',
          albumId: '',
          albumName: songName
        };
      }
    }
    
    // METHOD 4: Tìm row có pause button VÀ có visual indicator (playing state)
    const audioTable = document.querySelector('table[data-testid="AudioTable"]') ||
                       document.querySelector('div[data-testid="ComposableAudioList"]') ||
                       document.querySelector('table') ||
                       document.querySelector('[role="table"]');
    
    if (audioTable) {
      console.log('📊 Found table, searching for playing row...');
      
      // Tìm tất cả rows có pause button
      const allRows = audioTable.querySelectorAll('tr, div[role="row"], div[class*="row" i]');
      console.log('Found rows:', allRows.length);
      
      for (const row of allRows) {
        // Check xem row này có pause button không (nhiều cách khác nhau)
        const pauseBtn = row.querySelector('button[aria-label*="Pause" i]') ||
                         row.querySelector('button[title*="Pause" i]') ||
                         row.querySelector('button[aria-label*="Tạm dừng" i]') ||
                         row.querySelector('svg[data-icon="pause"]') ||
                         row.querySelector('svg[aria-label*="pause" i]') ||
                         row.querySelector('[class*="pause" i]');
        
        if (pauseBtn) {
          console.log('⏸️ Found pause button in row');
          
          // Check xem button có visible và not disabled
          const isVisible = pauseBtn.offsetParent !== null;
          const buttonElement = pauseBtn.closest('button') || pauseBtn;
          const isDisabled = buttonElement?.disabled || buttonElement?.getAttribute('disabled');
          
          console.log('Pause button visible:', isVisible, 'disabled:', isDisabled);
          
          if (isVisible && !isDisabled) {
            const songLink = row.querySelector('a[href*="/song/"]');
            if (songLink) {
              songName = songLink.textContent?.trim() || songLink.innerText?.trim() || '';
              const href = songLink.getAttribute('href') || '';
              const parts = href.split('/');
              songId = parts[parts.length - 1].split('?')[0];
            }
            
            const artistLink = row.querySelector('a[href*="/artist/"]');
            if (artistLink) {
              artistName = artistLink.textContent?.trim() || artistLink.innerText?.trim() || '';
            }
            
            if (songName) {
              console.log('✅ Found playing song from table:', songName);
              return {
                songId: songId || 'unknown',
                songName: songName,
                artistId: '',
                artistName: artistName || 'Unknown Artist',
                albumId: '',
                albumName: songName
              };
            }
          }
        }
      }
      
      console.log('❌ No playing row found in table');
    } else {
      console.log('❌ No table found');
    }
    
    // METHOD 5: Try extracting from page title or meta tags
    if (!songName) {
      console.log('🔍 Trying to extract from page metadata...');
      
      // Check document title (format: "Song Name - Artist | Artlist")
      const title = document.title;
      if (title && title.includes(' - ') && title.includes('Artlist')) {
        const parts = title.split(' - ');
        if (parts.length >= 2) {
          songName = parts[0].trim();
          artistName = parts[1].split('|')[0].trim();
          console.log('📄 Extracted from title:', songName, 'by', artistName);
        }
      }
      
      // Try to find song ID from current URL if on song page
      if (window.location.pathname.includes('/song/')) {
        const pathParts = window.location.pathname.split('/');
        songId = pathParts[pathParts.length - 1].split('?')[0];
        console.log('📍 Extracted song ID from URL:', songId);
      }
    }
    
    if (!songName) {
      console.log('❌ Could not find song info from UI');
      return null;
    }
    
    return {
      songId: songId || 'unknown',
      songName: songName,
      artistId: '',
      artistName: artistName || 'Unknown Artist',
      albumId: '',
      albumName: songName
    };
    
  } catch (error) {
    console.error('Error extracting song info:', error);
    return null;
  }
}

// Start monitoring khi script load
monitorAudioPlayer();

// Hook XMLHttpRequest để intercept API responses từ trang Artlist
(function() {
  const oldXHROpen = window.XMLHttpRequest.prototype.open;
  const oldXHRSend = window.XMLHttpRequest.prototype.send;
  
  window.XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    this._method = method;
    return oldXHROpen.apply(this, arguments);
  };
  
  window.XMLHttpRequest.prototype.send = function() {
    const xhr = this;
    
    this.addEventListener('load', function() {
      if (xhr._url && xhr._url.includes('search-api.artlist.io') && xhr._url.includes('graphql')) {
        try {
          const responseData = JSON.parse(xhr.responseText);
          console.log('✅ Intercepted Artlist API response:', responseData);
          
          // Lưu data vào cache
          if (responseData.data) {
            // Single song response
            if (responseData.data.song) {
              cachedSongsData.push(responseData.data.song);
              console.log('📦 Cached single song, total:', cachedSongsData.length);
            }
            // Multiple songs response
            if (responseData.data.songs && Array.isArray(responseData.data.songs)) {
              cachedSongsData.push(...responseData.data.songs);
              console.log('📦 Cached songs array, total:', cachedSongsData.length);
            }
            // SFX
            if (responseData.data.sfxs) {
              cachedSfxData.push(...responseData.data.sfxs);
            }
          }
        } catch (e) {
          console.warn('Could not parse XHR response:', e);
        }
      }
    });
    
    return oldXHRSend.apply(this, arguments);
  };
  
  console.log('🔧 XHR interceptor installed successfully');
})();

// Lắng nghe message từ popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSongInfo') {
    console.log('🎵 Content script: Getting song info for ID', request.songId);
    
    // Method 1: Tìm trong cached data từ XHR intercept
    const cachedSong = findSongInCache(request.songId);
    if (cachedSong) {
      console.log('✅ Found song in XHR cache!', cachedSong);
      const normalized = normalizeSongData(cachedSong);
      sendResponse({ success: true, data: normalized });
      return true;
    }
    
    console.log('⚠️ Song not in cache, trying direct API call from page context...');
    
    // Method 2: Gọi API trực tiếp từ page context (không bị CORS)
    fetchSongFromPageContext(request.songId)
      .then(apiData => {
        if (apiData && apiData.sitePlayableFilePath) {
          console.log('✅ Song data fetched from API (page context)', apiData);
          sendResponse({ success: true, data: apiData });
          return;
        }
        
        console.log('⚠️ API failed, trying to scrape from page...');
        return scrapeSongDataFromPage();
      })
      .then(scrapedData => {
        if (scrapedData && scrapedData.sitePlayableFilePath) {
          console.log('✅ Song data scraped from page', scrapedData);
          sendResponse({ success: true, data: scrapedData });
        } else {
          console.error('❌ All methods failed');
          sendResponse({ 
            success: false, 
            error: 'Không thể lấy dữ liệu. Vui lòng PHÁT NHẠC hoặc REFRESH trang!' 
          });
        }
      })
      .catch(error => {
        console.error('❌ Error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Giữ message channel mở
  }
  
  // NEW: Get currently playing song
  if (request.action === 'getCurrentSong') {
    console.log('🎵 Getting currently playing song...');
    
    // Detect lại để đảm bảo có thông tin mới nhất
    detectCurrentSong();
    
    if (currentPlayingSong && currentPlayingSong.songName) {
      console.log('✅ Returning current playing song:', currentPlayingSong);
      
      // Nếu có songId nhưng chưa có download link, thử fetch từ API
      if (currentPlayingSong.songId && !currentPlayingSong.sitePlayableFilePath) {
        console.log('⚠️ Have songId but no download link, fetching from API...');
        
        fetchSongFromPageContext(currentPlayingSong.songId)
          .then(apiData => {
            if (apiData && apiData.sitePlayableFilePath) {
              const enriched = { ...currentPlayingSong, ...apiData };
              console.log('✅ Enriched with API data:', enriched);
              sendResponse({ success: true, data: enriched });
            } else {
              // Vẫn return data hiện tại, có thể dùng audio URL
              console.log('⚠️ API failed, returning current data with audio URL');
              sendResponse({ success: true, data: currentPlayingSong });
            }
          })
          .catch(err => {
            console.error('API error:', err);
            sendResponse({ success: true, data: currentPlayingSong });
          });
        
        return true;
      }
      
      sendResponse({ success: true, data: currentPlayingSong });
    } else {
      console.log('❌ No song currently playing');
      sendResponse({ 
        success: false, 
        error: 'Không có bài hát nào đang phát. Vui lòng phát một bài hát!' 
      });
    }
    
    return true;
  }
  
  // NEW: Get any song from page (fallback)
  if (request.action === 'getAnySong') {
    console.log('🔍 Getting any song from page...');
    
    scrapeSongDataFromPage()
      .then(songData => {
        if (songData && songData.sitePlayableFilePath) {
          console.log('✅ Found song on page:', songData);
          sendResponse({ success: true, data: songData });
        } else {
          console.log('❌ No song found on page');
          sendResponse({ success: false, error: 'No song found' });
        }
      })
      .catch(error => {
        console.error('❌ Error getting song from page:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
});

function findSongInCache(songId) {
  const songIdNum = parseInt(songId);
  const songIdStr = songId.toString();
  
  // Tìm trong cached songs
  for (const song of cachedSongsData) {
    const id = song.id || song.songId;
    if (id === songIdStr || id === songIdNum || 
        parseInt(id) === songIdNum || id.toString() === songIdStr) {
      console.log('🎯 Match found:', song);
      return song;
    }
  }
  
  console.log('❌ No match in cache. Cached items:', cachedSongsData.length);
  return null;
}

function normalizeSongData(song) {
  // Chuẩn hóa data từ nhiều format khác nhau của Artlist API
  const normalized = {
    songId: song.id || song.songId || '',
    songName: song.title || song.songName || 'Unknown',
    artistId: song.artist?.id || song.artistId || '',
    artistName: song.artist?.name || song.artistName || 'Unknown Artist',
    albumId: song.album?.id || song.albumId || '',
    albumName: song.album?.title || song.albumName || song.title || song.songName || 'Unknown Album',
    sitePlayableFilePath: song.waveform?.playableFileUrl || song.sitePlayableFilePath || null
  };
  
  console.log('📋 Normalized song data:', normalized);
  return normalized;
}

async function fetchSongFromPageContext(songId) {
  try {
    console.log('🌐 Fetching song from API (page context)...');
    
    // Gọi API từ context của trang Artlist (không bị CORS)
    const query = `query Songs($ids: [String!]!) {
      songs(ids: $ids) {
        songId
        songName
        artistId
        artistName
        albumId
        albumName
        assetTypeId
        duration
        sitePlayableFilePath
      }
    }`;

    const variables = {
      ids: [songId.toString()]
    };

    const response = await fetch('https://search-api.artlist.io/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        variables: variables
      })
    });

    console.log('API Response status:', response.status);

    if (!response.ok) {
      console.warn('API returned error:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('API Response data:', data);

    if (data.errors) {
      console.error('GraphQL Errors:', data.errors);
      return null;
    }

    if (data.data && data.data.songs && data.data.songs[0]) {
      return data.data.songs[0];
    }

    return null;
  } catch (error) {
    console.error('Error fetching from API:', error);
    return null;
  }
}

async function scrapeSongDataFromPage() {
  try {
    console.log('🔍 Attempting to scrape song data from page...');
    
    let songId = '';
    let title = '';
    let artistName = 'Unknown';
    let artistId = '';
    
    // Check if we're on an album page with a modal/detail view open
    const isAlbumPage = window.location.pathname.includes('/album/');
    
    if (isAlbumPage) {
      console.log('📀 Detected album page, looking for active/selected song...');
      
      // Method 1: Tìm modal hoặc detail view đang mở
      const modal = document.querySelector('[role="dialog"]') || 
                    document.querySelector('[data-testid="Modal"]') ||
                    document.querySelector('.modal') ||
                    document.querySelector('[class*="Modal"]');
      
      if (modal) {
        console.log('🎯 Found modal/detail view');
        
        // Tìm song link trong modal
        const songLink = modal.querySelector('a[href*="/song/"]');
        if (songLink) {
          const href = songLink.getAttribute('href');
          const parts = href.split('/');
          songId = parts[parts.length - 1];
          title = songLink.textContent?.trim() || '';
          console.log('✅ Extracted from modal:', { songId, title });
        }
        
        // Tìm artist trong modal
        const artistLink = modal.querySelector('a[href*="/artist/"]');
        if (artistLink) {
          artistName = artistLink.textContent?.trim() || 'Unknown';
          const href = artistLink.getAttribute('href');
          const parts = href.split('/');
          artistId = parts[parts.length - 1];
        }
      }
      
      // Method 2: Tìm row có class active/selected/playing
      if (!songId) {
        console.log('🔍 Looking for active row in table...');
        const rows = document.querySelectorAll('tr, div[role="row"], [class*="row"]');
        
        for (const row of rows) {
          // Check for active/selected/playing indicators
          const hasActiveClass = row.className.includes('active') || 
                                 row.className.includes('selected') ||
                                 row.className.includes('playing') ||
                                 row.className.includes('current');
          
          const hasActiveAttribute = row.getAttribute('aria-selected') === 'true' ||
                                    row.getAttribute('data-active') === 'true' ||
                                    row.getAttribute('data-selected') === 'true';
          
          if (hasActiveClass || hasActiveAttribute) {
            const songLink = row.querySelector('a[href*="/song/"]');
            if (songLink) {
              const href = songLink.getAttribute('href');
              const parts = href.split('/');
              songId = parts[parts.length - 1];
              title = songLink.textContent?.trim() || '';
              
              const artistLink = row.querySelector('a[href*="/artist/"]');
              if (artistLink) {
                artistName = artistLink.textContent?.trim() || 'Unknown';
                const href = artistLink.getAttribute('href');
                const parts = href.split('/');
                artistId = parts[parts.length - 1];
              }
              
              console.log('✅ Found active row:', { songId, title });
              break;
            }
          }
        }
      }
    } else {
      // Not an album page, use URL-based detection
      const urlParts = window.location.pathname.split('/');
      songId = urlParts[urlParts.length - 1];
      
      // Tìm title
      const titleElement = document.querySelector('h1[data-testid="Heading"]');
      if (titleElement) {
        title = titleElement.textContent.trim();
      }
      
      // Tìm artist
      const artistLinks = document.querySelectorAll('a[data-testid="Link"]');
      for (const link of artistLinks) {
        const href = link.getAttribute('href');
        if (href && href.includes('/artist/')) {
          artistName = link.textContent.trim();
          const parts = href.split('/');
          artistId = parts[parts.length - 1];
          break;
        }
      }
    }
    
    if (!songId || !title) {
      console.warn('⚠️ Could not find song ID or title');
      return null;
    }
    
    // Tìm audio URL - Method 1: Audio element
    let audioUrl = null;
    const audioElements = document.querySelectorAll('audio');
    if (audioElements.length > 0 && audioElements[0].src) {
      audioUrl = audioElements[0].src;
      console.log('✅ Found audio URL in <audio> tag');
    }
    
    // Method 2: __NEXT_DATA__
    if (!audioUrl && window.__NEXT_DATA__) {
      try {
        const pageData = JSON.stringify(window.__NEXT_DATA__);
        const match = pageData.match(/"(?:playableFileUrl|sitePlayableFilePath)"\s*:\s*"([^"]+)"/);
        if (match) {
          audioUrl = match[1];
          console.log('✅ Found audio URL in __NEXT_DATA__');
        }
      } catch (e) {
        console.warn('Could not extract from __NEXT_DATA__', e);
      }
    }
    
    // Method 3: Performance API (last recently loaded .aac file)
    if (!audioUrl && window.performance) {
      const resources = performance.getEntriesByType('resource');
      const audioResources = resources.filter(r => 
        r.name.includes('.aac') || 
        r.name.includes('.m4a') || 
        r.name.includes('cms-public-artifacts')
      );
      
      if (audioResources.length > 0) {
        // Get the most recent one
        audioUrl = audioResources[audioResources.length - 1].name;
        console.log('✅ Found audio URL in performance resources');
      }
    }
    
    if (!audioUrl) {
      console.warn('⚠️ Could not find audio URL. Did you play the song?');
      return null;
    }
    
    const result = {
      songId: songId,
      songName: title,
      artistId: artistId,
      artistName: artistName,
      albumId: '',
      albumName: title,
      sitePlayableFilePath: audioUrl
    };
    
    console.log('📋 Scraped data:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Scraping error:', error);
    return null;
  }
}

console.log('✅ Content script fully initialized');
