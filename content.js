// Content script để inject vào trang Artlist và lấy dữ liệu
// PHƯƠNG PHÁP: Intercept XHR + Detect playing song

console.log('Artlist Downloader - content script loaded');

// Storage cho cached data từ XHR intercept
const cachedSongsData = [];
const cachedSfxData = [];

// Storage cho current playing song
let currentPlayingSong = null;

// Monitor audio element để detect bài hát đang phát
function monitorAudioPlayer() {
  const checkAudio = setInterval(() => {
    const audioElement = document.querySelector('audio');
    if (audioElement) {
      console.log('🎵 Found audio element, monitoring...');
      
      // Lắng nghe khi bài hát được play
      audioElement.addEventListener('play', function() {
        console.log('▶️ Song started playing');
        detectCurrentSong();
      });
      
      // Lắng nghe khi src thay đổi
      const observer = new MutationObserver(() => {
        if (audioElement.src) {
          console.log('🔄 Audio source changed:', audioElement.src);
          detectCurrentSong();
        }
      });
      
      observer.observe(audioElement, { 
        attributes: true, 
        attributeFilter: ['src'] 
      });
      
      clearInterval(checkAudio);
    }
  }, 1000);
  
  // Stop sau 30 giây nếu không tìm thấy
  setTimeout(() => clearInterval(checkAudio), 30000);
}

// Detect bài hát đang phát
function detectCurrentSong() {
  try {
    const songInfo = extractSongInfoFromUI();
    if (!songInfo) return;
    
    let audioUrl = '';
    const audioElement = document.querySelector('audio');
    if (audioElement) {
      audioUrl = audioElement.currentSrc || audioElement.src || '';
    }
    
    currentPlayingSong = {
      ...songInfo,
      sitePlayableFilePath: audioUrl,
      detectedAt: Date.now()
    };
  } catch (error) {
    // Silent fail
  }
}

// Extract thông tin bài hát từ UI (player đang phát)
function extractSongInfoFromUI() {
  try {
    let songName = '';
    let artistName = '';
    let songId = '';
    
    const allRows = document.querySelectorAll('div, tr, li');
    
    for (const row of allRows) {
      const pauseBtn = row.querySelector('button[aria-label*="Pause"]') ||
                       row.querySelector('button[title*="Pause"]') ||
                       row.querySelector('button[aria-label*="pause"]') ||
                       row.querySelector('svg[aria-label*="pause"]');
      
      if (pauseBtn) {
        const songLink = row.querySelector('a[href*="/song/"]');
        if (songLink) {
          songName = songLink.textContent?.trim() || '';
          const href = songLink.getAttribute('href') || '';
          const parts = href.split('/');
          songId = parts[parts.length - 1];
        }
        
        const artistLink = row.querySelector('a[href*="/artist/"]');
        if (artistLink) {
          artistName = artistLink.textContent?.trim() || '';
        }
        
        if (songName) break;
      }
    }
    
    if (!songName) return null;
    
    return {
      songId: songId || 'unknown',
      songName: songName,
      artistId: '',
      artistName: artistName || 'Unknown Artist',
      albumId: '',
      albumName: songName
    };
    
  } catch (error) {
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
    
    if (currentPlayingSong) {
      console.log('✅ Returning current playing song:', currentPlayingSong);
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
    
    // Lấy song ID từ URL
    const urlParts = window.location.pathname.split('/');
    const songId = urlParts[urlParts.length - 1];
    
    // Tìm title
    const titleElement = document.querySelector('h1[data-testid="Heading"]');
    if (!titleElement) {
      console.warn('⚠️ Could not find title element');
      return null;
    }
    const title = titleElement.textContent.trim();
    
    // Tìm artist
    let artistName = 'Unknown';
    let artistId = '';
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
    
    // Method 3: Performance API
    if (!audioUrl && window.performance) {
      const resources = performance.getEntriesByType('resource');
      for (const resource of resources) {
        if (resource.name.includes('.aac') || resource.name.includes('.m4a') || 
            resource.name.includes('cms-public-artifacts')) {
          audioUrl = resource.name;
          console.log('✅ Found audio URL in performance resources');
          break;
        }
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
