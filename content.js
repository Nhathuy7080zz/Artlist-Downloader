// Content script - Artlist Downloader v3 (Production)
// Supports: Music & Sound Effects

const DEBUG = false; // Set to true to enable console logs
const log = (...args) => DEBUG && console.log('[Artlist DL]', ...args);
const warn = (...args) => DEBUG && console.warn('[Artlist DL]', ...args);
const error = (...args) => DEBUG && console.error('[Artlist DL]', ...args);

// Storage
const cachedSongsData = [];
const cachedSfxData = [];
let currentPlayingSong = null;
let isDetecting = false;
let lastDetectionTime = 0;

// Detect current playing song/sfx
function detectCurrentSong() {
  const now = Date.now();
  if (now - lastDetectionTime < 1000) return;
  if (isDetecting) return;
  
  isDetecting = true;
  lastDetectionTime = now;
  
  try {
    const songInfo = extractSongInfoFromUI();
    
    // If no songInfo and we already have currentPlayingSong, keep it
    if (!songInfo) {
      if (currentPlayingSong) {
        log('⚠️ No new info found, keeping existing data');
      } else {
        log('❌ No song info found and no existing data');
      }
      isDetecting = false;
      return;
    }
    
    let audioUrl = '';
    let audioElement = document.querySelector('audio');
    
    // Try multiple ways to find audio element
    if (!audioElement) {
      // Try finding in shadow DOM or iframe
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.shadowRoot) {
          const shadowAudio = el.shadowRoot.querySelector('audio');
          if (shadowAudio) {
            audioElement = shadowAudio;
            log('🎵 Found audio in shadow DOM');
            break;
          }
        }
      }
    }
    
    if (audioElement) {
      audioUrl = audioElement.currentSrc || audioElement.src || '';
      log('🎵 Audio element found!');
      log('🎵 Audio URL:', audioUrl ? audioUrl.substring(0, 80) + '...' : 'EMPTY');
      log('🎵 Audio paused:', audioElement.paused);
      log('🎵 Audio currentTime:', audioElement.currentTime);
    } else {
      log('❌ No audio element found anywhere!');
      log('🔍 Trying performance API to find audio file...');
      
      // Fallback: Try to find audio URL from performance/network resources
      if (window.performance) {
        const resources = performance.getEntriesByType('resource');
        const audioResources = resources.filter(r => 
          r.name.includes('.aac') || 
          r.name.includes('.m4a') || 
          r.name.includes('.mp3') ||
          r.name.includes('.wav') ||
          r.name.includes('cms-public-artifacts')
        );
        
        if (audioResources.length > 0) {
          // Get the most recent one
          audioUrl = audioResources[audioResources.length - 1].name;
          log('✅ Found audio URL from performance API:', audioUrl.substring(0, 80) + '...');
        }
      }
      
      // If still no audio URL and we have songName, we'll need to use API
      if (!audioUrl && songInfo.songId) {
        log('⚠️ No audio URL, will need to fetch from API or wait for audio to load');
      }
    }
    
    // If we have songInfo but no audio URL yet, still save it
    // The retry will update it with audio URL
    const isDifferentAudio = !currentPlayingSong || 
                             currentPlayingSong.songId !== songInfo.songId ||
                             currentPlayingSong.sitePlayableFilePath !== audioUrl;
    
    if (isDifferentAudio) {
      log('🔄 New audio detected, updating...');
    }
    
    currentPlayingSong = {
      ...songInfo,
      sitePlayableFilePath: audioUrl,
      detectedAt: Date.now()
    };
    
    log('💾 Current playing saved:', currentPlayingSong);
  } catch (err) {
    error('Error detecting:', err);
  } finally {
    isDetecting = false;
  }
}

// Monitor audio player
function monitorAudioPlayer() {
  let audioElement = null;
  let isMonitoring = false;
  
  const setupAudioMonitoring = (audio) => {
    if (isMonitoring) return;
    isMonitoring = true;
    
    audio.addEventListener('play', () => setTimeout(() => detectCurrentSong(), 500));
    audio.addEventListener('loadeddata', () => setTimeout(() => detectCurrentSong(), 500));
    
    let lastCheck = 0;
    audio.addEventListener('timeupdate', function() {
      const now = Date.now();
      if (now - lastCheck > 5000) {
        lastCheck = now;
        detectCurrentSong();
      }
    });
    
    const observer = new MutationObserver(() => {
      if (audio.src && audio.currentSrc) {
        setTimeout(() => detectCurrentSong(), 500);
      }
    });
    
    observer.observe(audio, { 
      attributes: true, 
      attributeFilter: ['src', 'currentSrc'] 
    });
  };
  
  let lastAudioSrc = '';
  
  const checkAudio = () => {
    const audio = document.querySelector('audio');
    if (audio) {
      const currentSrc = audio.currentSrc || audio.src || '';
      
      // NEW: Reset if audio element changed OR source changed
      if (audio !== audioElement || (currentSrc && currentSrc !== lastAudioSrc)) {
        if (currentSrc !== lastAudioSrc) {
          log('🔄 Audio source changed, resetting detection...');
          currentPlayingSong = null; // Clear old data
          lastAudioSrc = currentSrc;
        }
        
        audioElement = audio;
        isMonitoring = false;
        setupAudioMonitoring(audio);
        
        if (!audio.paused) {
          setTimeout(() => detectCurrentSong(), 1000);
        }
      }
    }
  };
  
  checkAudio();
  setInterval(checkAudio, 2000);
  
  if (document.readyState === 'complete') {
    setTimeout(() => detectCurrentSong(), 2000);
  } else {
    window.addEventListener('load', () => setTimeout(() => detectCurrentSong(), 2000));
  }
}

// Extract song/sfx info from UI
function extractSongInfoFromUI() {
  try {
    let songName = '';
    let artistName = '';
    let songId = '';
    let isSfx = false;
    
    // Check if on SFX page
    if (window.location.pathname.includes('/sfx/') || window.location.pathname.includes('/sound-effects/')) {
      isSfx = true;
    }
    
    // METHOD 1: Player bar
    const playerBar = document.querySelector('[data-testid="MusicPlayer"]') || 
                      document.querySelector('[data-testid="AudioPlayer"]') ||
                      document.querySelector('[class*="MusicPlayer"]') ||
                      document.querySelector('[class*="AudioPlayer"]') ||
                      document.querySelector('[class*="player" i]:has(audio)') ||
                      document.querySelector('div[class*="Player" i]:has(audio)') ||
                      document.querySelector('footer:has(audio)') ||
                      document.querySelector('div[role="region"]:has(audio)');
    
    if (playerBar) {
      const allLinks = playerBar.querySelectorAll('a[href*="/song/"], a[href*="/sfx/"]');
      const songLink = allLinks[0];
      const artistLink = playerBar.querySelector('a[href*="/artist/"]');
      
      if (songLink) {
        songName = songLink.textContent?.trim() || songLink.innerText?.trim() || '';
        const href = songLink.getAttribute('href') || '';
        const parts = href.split('/');
        songId = parts[parts.length - 1].split('?')[0];
        
        if (href.includes('/sfx/')) {
          isSfx = true;
        }
      }
      
      if (artistLink) {
        artistName = artistLink.textContent?.trim() || artistLink.innerText?.trim() || '';
      }
      
      if (songName) {
        return {
          songId: songId || 'unknown',
          songName: songName,
          artistId: '',
          artistName: artistName || (isSfx ? 'Artlist' : 'Unknown Artist'),
          albumId: '',
          albumName: songName,
          isSfx: isSfx
        };
      }
    }
    
    // METHOD 2: Audio element + URL matching (PRIORITY for getting real SFX ID)
    let audioElement = document.querySelector('audio');
    let foundAudioUrl = '';
    
    // Try shadow DOM if not found
    if (!audioElement) {
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.shadowRoot) {
          audioElement = el.shadowRoot.querySelector('audio');
          if (audioElement) break;
        }
      }
    }
    
    // Get audio URL from element or performance API
    if (audioElement && audioElement.src) {
      foundAudioUrl = audioElement.src || audioElement.currentSrc || '';
    } else if (window.performance) {
      const resources = performance.getEntriesByType('resource');
      const audioResources = resources.filter(r => 
        (r.name.includes('.aac') || r.name.includes('.m4a') || r.name.includes('.mp3')) &&
        r.name.includes('cms-public-artifacts')
      );
      if (audioResources.length > 0) {
        foundAudioUrl = audioResources[audioResources.length - 1].name;
        log('🎯 Using audio URL from performance API');
      }
    }
    
    if (foundAudioUrl) {
      // IMPORTANT: Extract REAL ID from audio URL (especially for SFX packs)
      const urlMatch = foundAudioUrl.match(/\/(\d+)\./);
      if (urlMatch) {
        const realAudioId = urlMatch[1];
        log('🎯 Real audio ID from URL:', realAudioId);
        
        // If we already have songName from pack link, just update the ID
        if (songName && songId && songId !== realAudioId) {
          log('📝 Updating songId from pack ID to real audio ID:', songId, '→', realAudioId);
          songId = realAudioId;
        }
        
        // If we don't have songName yet, try to find matching link
        if (!songName) {
          const possibleLink = document.querySelector(`a[href*="/song/${realAudioId}"], a[href*="/sfx/${realAudioId}"]`);
          if (possibleLink) {
            songName = possibleLink.textContent?.trim() || possibleLink.innerText?.trim() || '';
            songId = realAudioId;
            const href = possibleLink.href || possibleLink.getAttribute('href') || '';
            if (href.includes('/sfx/')) {
              isSfx = true;
            }
          }
        }
      }
      
      // Check if audio URL suggests SFX
      if (foundAudioUrl.includes('/sfx/') || foundAudioUrl.includes('sfx-') || 
          window.location.pathname.includes('/sound-effects/')) {
        isSfx = true;
      }
    }
    
    // METHOD 3: Modal
    const modal = document.querySelector('[role="dialog"]') || 
                  document.querySelector('[data-testid="Modal"]') ||
                  document.querySelector('[class*="Modal" i]');
    
    if (modal) {
      const songLink = modal.querySelector('a[href*="/song/"], a[href*="/sfx/"]');
      const artistLink = modal.querySelector('a[href*="/artist/"]');
      
      if (songLink) {
        songName = songLink.textContent?.trim() || songLink.innerText?.trim() || '';
        const href = songLink.getAttribute('href') || '';
        const parts = href.split('/');
        songId = parts[parts.length - 1].split('?')[0];
        
        if (href.includes('/sfx/')) {
          isSfx = true;
        }
      }
      
      if (artistLink) {
        artistName = artistLink.textContent?.trim() || artistLink.innerText?.trim() || '';
      }
      
      if (songName) {
        return {
          songId: songId || 'unknown',
          songName: songName,
          artistId: '',
          artistName: artistName || (isSfx ? 'Artlist' : 'Unknown Artist'),
          albumId: '',
          albumName: songName,
          isSfx: isSfx
        };
      }
    }
    
    // METHOD 4: Table with pause button
    const audioTable = document.querySelector('table[data-testid="AudioTable"]') ||
                       document.querySelector('div[data-testid="ComposableAudioList"]') ||
                       document.querySelector('table') ||
                       document.querySelector('[role="table"]');
    
    if (audioTable) {
      const allRows = audioTable.querySelectorAll('tr, div[role="row"], div[class*="row" i]');
      
      for (const row of allRows) {
        const pauseBtn = row.querySelector('button[aria-label*="Pause" i]') ||
                         row.querySelector('button[title*="Pause" i]') ||
                         row.querySelector('svg[data-icon="pause"]') ||
                         row.querySelector('svg[aria-label*="pause" i]');
        
        if (pauseBtn) {
          const isVisible = pauseBtn.offsetParent !== null;
          const buttonElement = pauseBtn.closest('button') || pauseBtn;
          const isDisabled = buttonElement?.disabled || buttonElement?.getAttribute('disabled');
          
          if (isVisible && !isDisabled) {
            const songLink = row.querySelector('a[href*="/song/"], a[href*="/sfx/"]');
            if (songLink) {
              songName = songLink.textContent?.trim() || songLink.innerText?.trim() || '';
              const href = songLink.getAttribute('href') || '';
              const parts = href.split('/');
              songId = parts[parts.length - 1].split('?')[0];
              
              if (href.includes('/sfx/')) {
                isSfx = true;
              }
            }
            
            const artistLink = row.querySelector('a[href*="/artist/"]');
            if (artistLink) {
              artistName = artistLink.textContent?.trim() || artistLink.innerText?.trim() || '';
            }
            
            if (songName) {
              return {
                songId: songId || 'unknown',
                songName: songName,
                artistId: '',
                artistName: artistName || (isSfx ? 'Artlist' : 'Unknown Artist'),
                albumId: '',
                albumName: songName,
                isSfx: isSfx
              };
            }
          }
        }
      }
    }
    
    // METHOD 5: Page metadata and URL priority detection
    if (!songName) {
      // PRIORITY: Check current URL first
      if (window.location.pathname.includes('/sfx/') || window.location.pathname.includes('/sound-effects/')) {
        const pathParts = window.location.pathname.split('/');
        songId = pathParts[pathParts.length - 1].split('?')[0];
        isSfx = true;
        
        // Try to get name from page heading
        const heading = document.querySelector('h1, [data-testid="Heading"]');
        if (heading) {
          songName = heading.textContent?.trim() || '';
        }
      } else if (window.location.pathname.includes('/song/')) {
        const pathParts = window.location.pathname.split('/');
        songId = pathParts[pathParts.length - 1].split('?')[0];
        isSfx = false;
      }
      
      // Fallback to document title
      if (!songName) {
        const title = document.title;
        if (title && title.includes(' - ') && title.includes('Artlist')) {
          const parts = title.split(' - ');
          if (parts.length >= 2) {
            songName = parts[0].trim();
            artistName = parts[1].split('|')[0].trim();
          }
        }
      }
    }
    
    // METHOD 6: Last resort - find ANY visible playing indicator
    if (!songName) {
      log('🔍 Last resort: searching for any playing indicator...');
      
      // A. First try: Find pause button (most reliable)
      const pauseButtons = document.querySelectorAll('button[aria-label*="Pause" i], button[title*="Pause" i], [aria-label*="pause" i]');
      log('Found pause buttons:', pauseButtons.length);
      
      for (const pauseBtn of pauseButtons) {
        // Check if visible and not disabled
        const isVisible = pauseBtn.offsetParent !== null;
        const button = pauseBtn.closest('button') || pauseBtn;
        const isDisabled = button?.disabled;
        
        if (isVisible && !isDisabled) {
          log('✅ Found visible active pause button');
          
          // Find parent row/item
          const parent = pauseBtn.closest('tr, div[role="row"], div[class*="row" i], li, [class*="item" i], [class*="card" i]');
          if (parent) {
            log('Parent found:', parent);
            
            // Try to find ANY link (song, sfx, or pack)
            const link = parent.querySelector('a[href*="/song/"], a[href*="/sfx/"], a[href*="/pack/"]');
            if (link) {
              const href = link.getAttribute('href') || '';
              log('✅ Found link:', href, 'Name:', link.textContent?.trim());
              
              // Extract name from link text
              songName = link.textContent?.trim() || link.innerText?.trim() || '';
              
              // Determine type and ID
              if (href.includes('/sfx/pack/')) {
                // SFX Pack - extract pack name as song name
                isSfx = true;
                const parts = href.split('/');
                // URL format: /sfx/pack/drum-machines/11645
                // Get "drum-machines" or last part
                songId = parts[parts.length - 1];
                const packName = parts[parts.length - 2];
                if (!songName) {
                  songName = packName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                }
              } else if (href.includes('/sfx/')) {
                isSfx = true;
                const parts = href.split('/');
                songId = parts[parts.length - 1].split('?')[0];
              } else if (href.includes('/song/')) {
                isSfx = false;
                const parts = href.split('/');
                songId = parts[parts.length - 1].split('?')[0];
              }
              
              // Get artist if available
              const artist = parent.querySelector('a[href*="/artist/"]');
              if (artist) {
                artistName = artist.textContent?.trim() || '';
              }
              
              if (songName) {
                log('✅ Success! Found from pause button method');
                break;
              }
            } else {
              log('⚠️ Parent found but no link');
              // Try to extract text content directly
              const textElements = parent.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6');
              for (const el of textElements) {
                const text = el.textContent?.trim();
                if (text && text.length > 3 && text.length < 100) {
                  songName = text;
                  isSfx = window.location.pathname.includes('/sfx') || window.location.pathname.includes('/sound-effects');
                  log('✅ Extracted text from parent:', songName);
                  break;
                }
              }
              if (songName) break;
            }
          }
        }
      }
      
      // B. Second try: Look for playing class indicators
      if (!songName) {
        const playingIndicators = document.querySelectorAll('[class*="playing" i], [class*="active" i]');
        log('Found playing indicators:', playingIndicators.length);
        
        for (const indicator of playingIndicators) {
          const parent = indicator.closest('tr, div[role="row"], div[class*="row" i], li, [class*="item" i]');
          if (parent) {
            const link = parent.querySelector('a[href*="/song/"], a[href*="/sfx/"], a[href*="/pack/"]');
            if (link) {
              const href = link.getAttribute('href') || '';
              songName = link.textContent?.trim() || '';
              
              // Handle different URL types
              if (href.includes('/sfx/pack/')) {
                isSfx = true;
                const parts = href.split('/');
                songId = parts[parts.length - 1];
                const packName = parts[parts.length - 2];
                if (!songName) {
                  songName = packName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                }
              } else if (href.includes('/sfx/')) {
                isSfx = true;
                const parts = href.split('/');
                songId = parts[parts.length - 1].split('?')[0];
              } else {
                const parts = href.split('/');
                songId = parts[parts.length - 1].split('?')[0];
                isSfx = href.includes('/sfx/');
              }
              
              const artist = parent.querySelector('a[href*="/artist/"]');
              if (artist) {
                artistName = artist.textContent?.trim() || '';
              }
              
              if (songName) {
                log('✅ Found from playing class indicator:', songName);
                break;
              }
            }
          }
        }
      }
    }
    
    // If still no songName, but we have audio playing, use generic name
    if (!songName) {
      const audioElement = document.querySelector('audio');
      if (audioElement && (audioElement.currentSrc || audioElement.src)) {
        log('⚠️ No song name found, but audio is playing. Using generic name.');
        songName = 'Unknown Audio';
        isSfx = window.location.pathname.includes('/sfx') || window.location.pathname.includes('/sound-effects');
        
        // Try to extract ID from audio URL
        const audioUrl = audioElement.currentSrc || audioElement.src;
        const idMatch = audioUrl.match(/\/(\d+)\./);
        if (idMatch) {
          songId = idMatch[1];
        }
      } else {
        log('❌ No song name and no audio element');
        return null;
      }
    }
    
    // IMPORTANT: Even if we found songName from link but no audio element yet,
    // we should still return the data for manual URL input
    if (songName && !songId.includes('unknown')) {
      log('✅ Found song name from UI, will fetch audio URL from API');
    }
    
    log('✅ Final extracted info:', { songId, songName, isSfx });
    
    return {
      songId: songId || 'unknown',
      songName: songName,
      artistId: '',
      artistName: artistName || (isSfx ? 'Artlist' : 'Unknown Artist'),
      albumId: '',
      albumName: songName,
      isSfx: isSfx
    };
    
  } catch (err) {
    error('Error extracting:', err);
    return null;
  }
}

// Start monitoring
monitorAudioPlayer();

// XHR Interceptor
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
          
          if (responseData.data) {
            if (responseData.data.song) {
              cachedSongsData.push(responseData.data.song);
            }
            if (responseData.data.songs && Array.isArray(responseData.data.songs)) {
              cachedSongsData.push(...responseData.data.songs);
            }
            if (responseData.data.sfx) {
              cachedSfxData.push(responseData.data.sfx);
            }
            if (responseData.data.sfxs && Array.isArray(responseData.data.sfxs)) {
              cachedSfxData.push(...responseData.data.sfxs);
            }
          }
        } catch (e) {
          warn('Parse error:', e);
        }
      }
      
      // NEW: Intercept download URL requests
      if (xhr._url && (
          xhr._url.includes('download') || 
          xhr._url.includes('/files/') ||
          xhr._url.includes('cms-public-artifacts')
      )) {
        try {
          log('🎯 Download URL intercepted:', xhr._url);
          // Cache this URL for potential use
          if (!window._artlistDownloadUrls) {
            window._artlistDownloadUrls = [];
          }
          window._artlistDownloadUrls.push({
            url: xhr._url,
            timestamp: Date.now()
          });
          // Keep only last 10 URLs
          if (window._artlistDownloadUrls.length > 10) {
            window._artlistDownloadUrls.shift();
          }
        } catch (e) {
          warn('Download URL cache error:', e);
        }
      }
    });
    
    return oldXHRSend.apply(this, arguments);
  };
})();

// NEW: Intercept fetch API as well
(function() {
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    
    if (typeof url === 'string' && (
        url.includes('download') || 
        url.includes('/files/') ||
        url.includes('cms-public-artifacts')
    )) {
      log('🎯 Fetch download URL intercepted:', url);
      if (!window._artlistDownloadUrls) {
        window._artlistDownloadUrls = [];
      }
      window._artlistDownloadUrls.push({
        url: url,
        timestamp: Date.now()
      });
      if (window._artlistDownloadUrls.length > 10) {
        window._artlistDownloadUrls.shift();
      }
    }
    
    return originalFetch.apply(this, args);
  };
})();

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSongInfo' || request.action === 'getSfxInfo') {
    const id = request.songId || request.sfxId;
    const isSfx = request.action === 'getSfxInfo';
    
    // Try cache first
    const cached = isSfx ? findSfxInCache(id) : findSongInCache(id);
    if (cached) {
      const normalized = isSfx ? normalizeSfxData(cached) : normalizeSongData(cached);
      
      // If no download URL in cached data, try to get from intercepted URLs
      if (!normalized.sitePlayableFilePath || normalized.sitePlayableFilePath.includes('playable')) {
        const recentDownloadUrl = getRecentDownloadUrl(id);
        if (recentDownloadUrl) {
          normalized.sitePlayableFilePath = recentDownloadUrl;
          log('✅ Using intercepted download URL');
        }
      }
      
      sendResponse({ success: true, data: normalized });
      return true;
    }
    
    // Try API
    const fetchFunc = isSfx ? fetchSfxFromPageContext : fetchSongFromPageContext;
    fetchFunc(id)
      .then(apiData => {
        if (apiData && apiData.sitePlayableFilePath) {
          // Check if it's a preview URL, try to get better one
          if (apiData.sitePlayableFilePath.includes('playable')) {
            const recentDownloadUrl = getRecentDownloadUrl(id);
            if (recentDownloadUrl) {
              apiData.sitePlayableFilePath = recentDownloadUrl;
              log('✅ Replaced preview URL with intercepted download URL');
            }
          }
          sendResponse({ success: true, data: apiData });
          return;
        }
        return scrapeSongDataFromPage();
      })
      .then(scrapedData => {
        if (scrapedData && scrapedData.sitePlayableFilePath) {
          sendResponse({ success: true, data: scrapedData });
        } else {
          sendResponse({ 
            success: false, 
            error: 'Cannot get data. Please play the audio first!' 
          });
        }
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    
    return true;
  }
  
  if (request.action === 'getCurrentSong') {
    detectCurrentSong();
    
    if (currentPlayingSong && currentPlayingSong.songName) {
      if (currentPlayingSong.songId && !currentPlayingSong.sitePlayableFilePath) {
        const fetchFunc = currentPlayingSong.isSfx ? fetchSfxFromPageContext : fetchSongFromPageContext;
        fetchFunc(currentPlayingSong.songId)
          .then(apiData => {
            if (apiData && apiData.sitePlayableFilePath) {
              const enriched = { ...currentPlayingSong, ...apiData };
              sendResponse({ success: true, data: enriched });
            } else {
              sendResponse({ success: true, data: currentPlayingSong });
            }
          })
          .catch(() => {
            sendResponse({ success: true, data: currentPlayingSong });
          });
        
        return true;
      }
      
      sendResponse({ success: true, data: currentPlayingSong });
    } else {
      sendResponse({ 
        success: false, 
        error: 'No audio playing. Please play something first!' 
      });
    }
    
    return true;
  }
  
  if (request.action === 'getAnySong') {
    scrapeSongDataFromPage()
      .then(songData => {
        if (songData && songData.sitePlayableFilePath) {
          sendResponse({ success: true, data: songData });
        } else {
          sendResponse({ success: false, error: 'No audio found' });
        }
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    
    return true;
  }
});

// NEW: Helper to get recent download URL from intercepted requests
function getRecentDownloadUrl(audioId) {
  if (!window._artlistDownloadUrls || window._artlistDownloadUrls.length === 0) {
    return null;
  }
  
  // Get most recent URL that matches the audio ID
  const now = Date.now();
  const recentUrls = window._artlistDownloadUrls.filter(item => {
    // Only use URLs from last 60 seconds
    return (now - item.timestamp) < 60000;
  });
  
  if (recentUrls.length === 0) return null;
  
  // Try to find URL that contains the audio ID
  const matchingUrl = recentUrls.find(item => item.url.includes(audioId));
  if (matchingUrl) {
    return matchingUrl.url;
  }
  
  // Otherwise return most recent URL
  return recentUrls[recentUrls.length - 1].url;
}

// Helper functions
function findSongInCache(songId) {
  const songIdNum = parseInt(songId);
  const songIdStr = songId.toString();
  
  for (const song of cachedSongsData) {
    const id = song.id || song.songId;
    if (id === songIdStr || id === songIdNum || 
        parseInt(id) === songIdNum || id.toString() === songIdStr) {
      return song;
    }
  }
  return null;
}

function findSfxInCache(sfxId) {
  const sfxIdNum = parseInt(sfxId);
  const sfxIdStr = sfxId.toString();
  
  for (const sfx of cachedSfxData) {
    const id = sfx.id || sfx.sfxId;
    if (id === sfxIdStr || id === sfxIdNum || 
        parseInt(id) === sfxIdNum || id.toString() === sfxIdStr) {
      return sfx;
    }
  }
  return null;
}

function normalizeSongData(song) {
  // Try to get high quality download URL
  let downloadUrl = null;
  
  // Priority 1: waveform downloadFileUrl
  if (song.waveform?.downloadFileUrl) {
    downloadUrl = song.waveform.downloadFileUrl;
  }
  
  // Priority 2: files array - FILTER AUDIO ONLY
  if (!downloadUrl && song.files && song.files.length > 0) {
    // Filter audio files only
    const audioFiles = song.files.filter(f => {
      const format = (f.fileFormat || '').toUpperCase();
      const filename = (f.fileName || '').toLowerCase();
      const isAudio = ['WAV', 'AAC', 'MP3', 'FLAC', 'OGG', 'M4A'].includes(format) ||
                     filename.endsWith('.wav') || filename.endsWith('.aac') || 
                     filename.endsWith('.mp3') || filename.endsWith('.flac');
      const isVideo = ['MP4', 'MOV', 'AVI', 'WEBM'].includes(format) ||
                     filename.endsWith('.mp4') || filename.endsWith('.mov');
      return isAudio && !isVideo;
    });
    
    const wavFile = audioFiles.find(f => f.fileFormat === 'WAV' || f.fileFormat === 'wav');
    const aacFile = audioFiles.find(f => f.fileFormat === 'AAC' || f.fileFormat === 'aac');
    const mp3File = audioFiles.find(f => f.fileFormat === 'MP3' || f.fileFormat === 'mp3');
    
    const preferredFile = wavFile || aacFile || mp3File || audioFiles[0];
    if (preferredFile?.downloadFilePath) {
      downloadUrl = preferredFile.downloadFilePath;
    }
  }
  
  // Priority 3: Fallback to playable URL
  if (!downloadUrl) {
    downloadUrl = song.waveform?.playableFileUrl || song.sitePlayableFilePath;
  }
  
  return {
    songId: song.id || song.songId || '',
    songName: song.title || song.songName || 'Unknown',
    artistId: song.artist?.id || song.artistId || '',
    artistName: song.artist?.name || song.artistName || 'Unknown Artist',
    albumId: song.album?.id || song.albumId || '',
    albumName: song.album?.title || song.albumName || song.title || song.songName || 'Unknown Album',
    sitePlayableFilePath: downloadUrl,
    isSfx: false
  };
}

function normalizeSfxData(sfx) {
  // Try to get high quality download URL
  let downloadUrl = null;
  
  // Priority 1: waveform downloadFileUrl
  if (sfx.waveform?.downloadFileUrl) {
    downloadUrl = sfx.waveform.downloadFileUrl;
  }
  
  // Priority 2: files array - FILTER AUDIO ONLY
  if (!downloadUrl && sfx.files && sfx.files.length > 0) {
    // Filter audio files only
    const audioFiles = sfx.files.filter(f => {
      const format = (f.fileFormat || '').toUpperCase();
      const filename = (f.fileName || '').toLowerCase();
      const isAudio = ['WAV', 'AAC', 'MP3', 'FLAC', 'OGG', 'M4A'].includes(format) ||
                     filename.endsWith('.wav') || filename.endsWith('.aac') || 
                     filename.endsWith('.mp3') || filename.endsWith('.flac');
      const isVideo = ['MP4', 'MOV', 'AVI', 'WEBM'].includes(format) ||
                     filename.endsWith('.mp4') || filename.endsWith('.mov');
      return isAudio && !isVideo;
    });
    
    const wavFile = audioFiles.find(f => f.fileFormat === 'WAV' || f.fileFormat === 'wav');
    const aacFile = audioFiles.find(f => f.fileFormat === 'AAC' || f.fileFormat === 'aac');
    const mp3File = audioFiles.find(f => f.fileFormat === 'MP3' || f.fileFormat === 'mp3');
    
    const preferredFile = wavFile || aacFile || mp3File || audioFiles[0];
    if (preferredFile?.downloadFilePath) {
      downloadUrl = preferredFile.downloadFilePath;
    }
  }
  
  // Priority 3: Fallback to playable URL
  if (!downloadUrl) {
    downloadUrl = sfx.waveform?.playableFileUrl || sfx.sitePlayableFilePath;
  }
  
  return {
    songId: sfx.id || sfx.sfxId || '',
    songName: sfx.title || sfx.sfxName || 'Unknown',
    artistId: '',
    artistName: 'Artlist',
    albumId: '',
    albumName: sfx.title || sfx.sfxName || 'Unknown',
    sitePlayableFilePath: downloadUrl,
    isSfx: true
  };
}

async function fetchSongFromPageContext(songId) {
  try {
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
        files {
          fileFormat
          fileName
          downloadFilePath
        }
        waveform {
          playableFileUrl
          downloadFileUrl
        }
      }
    }`;

    const response = await fetch('https://search-api.artlist.io/v1/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        variables: { ids: [songId.toString()] }
      })
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.errors) return null;
    
    const song = data.data?.songs?.[0];
    if (!song) return null;
    
    // Try to get high quality download URL
    let downloadUrl = null;
    
    // Priority 1: waveform downloadFileUrl (usually high quality)
    if (song.waveform?.downloadFileUrl) {
      downloadUrl = song.waveform.downloadFileUrl;
      log('✅ Song - Using waveform.downloadFileUrl:', downloadUrl);
    }
    
    // Priority 2: files array - look for WAV or high quality format
    if (!downloadUrl && song.files && song.files.length > 0) {
      log('📦 Available files:', song.files.map(f => `${f.fileFormat} - ${f.fileName}`));
      
      // IMPORTANT: Filter AUDIO files only (exclude video)
      const audioFiles = song.files.filter(f => {
        const format = (f.fileFormat || '').toUpperCase();
        const filename = (f.fileName || '').toLowerCase();
        // Only include audio formats, exclude video
        const isAudio = ['WAV', 'AAC', 'MP3', 'FLAC', 'OGG', 'M4A'].includes(format) ||
                       filename.endsWith('.wav') || filename.endsWith('.aac') || 
                       filename.endsWith('.mp3') || filename.endsWith('.flac');
        const isVideo = ['MP4', 'MOV', 'AVI', 'WEBM'].includes(format) ||
                       filename.endsWith('.mp4') || filename.endsWith('.mov');
        return isAudio && !isVideo;
      });
      
      log('🎵 Audio files only:', audioFiles.map(f => f.fileFormat));
      
      const wavFile = audioFiles.find(f => f.fileFormat === 'WAV' || f.fileFormat === 'wav');
      const aacFile = audioFiles.find(f => f.fileFormat === 'AAC' || f.fileFormat === 'aac');
      const mp3File = audioFiles.find(f => f.fileFormat === 'MP3' || f.fileFormat === 'mp3');
      
      const preferredFile = wavFile || aacFile || mp3File || audioFiles[0];
      if (preferredFile?.downloadFilePath) {
        downloadUrl = preferredFile.downloadFilePath;
        log('✅ Song - Using files.downloadFilePath:', preferredFile.fileFormat, downloadUrl);
      }
    }
    
    // Priority 3: Fallback to playable file (preview quality)
    if (!downloadUrl) {
      downloadUrl = song.waveform?.playableFileUrl || song.sitePlayableFilePath;
      log('⚠️ Song - Using fallback playableFileUrl (preview quality):', downloadUrl);
    }
    
    log('🎵 FINAL SONG DOWNLOAD URL:', downloadUrl);
    
    return {
      ...song,
      sitePlayableFilePath: downloadUrl
    };
  } catch (err) {
    error('API error:', err);
    return null;
  }
}

async function fetchSfxFromPageContext(sfxId) {
  try {
    const query = `query Sfxs($ids: [String!]!) {
      sfxs(ids: $ids) {
        sfxId
        sfxName
        duration
        sitePlayableFilePath
        siteDownloadableFilePath
        downloadFilePath
        files {
          fileFormat
          fileName
          downloadFilePath
          filePath
        }
        waveform {
          playableFileUrl
          downloadFileUrl
        }
      }
    }`;

    log('🔍 Fetching SFX data for ID:', sfxId);

    const response = await fetch('https://search-api.artlist.io/v1/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        variables: { ids: [sfxId.toString()] }
      })
    });

    if (!response.ok) {
      log('❌ SFX API response not OK:', response.status);
      return null;
    }
    
    const data = await response.json();
    if (data.errors) {
      log('❌ SFX API errors:', data.errors);
      return null;
    }
    
    const sfx = data.data?.sfxs?.[0];
    if (!sfx) {
      log('❌ No SFX data found');
      return null;
    }
    
    log('📦 RAW SFX DATA:', JSON.stringify(sfx, null, 2));
    
    log('📦 RAW SFX DATA:', JSON.stringify(sfx, null, 2));
    
    // Try to get high quality download URL
    let downloadUrl = null;
    
    // Priority 0: Direct download fields (SFX specific)
    if (sfx.siteDownloadableFilePath) {
      downloadUrl = sfx.siteDownloadableFilePath;
      log('✅ SFX - Using siteDownloadableFilePath:', downloadUrl);
    }
    
    if (!downloadUrl && sfx.downloadFilePath) {
      downloadUrl = sfx.downloadFilePath;
      log('✅ SFX - Using downloadFilePath:', downloadUrl);
    }
    
    // Priority 1: waveform downloadFileUrl
    if (!downloadUrl && sfx.waveform?.downloadFileUrl) {
      downloadUrl = sfx.waveform.downloadFileUrl;
      log('✅ SFX - Using waveform.downloadFileUrl:', downloadUrl);
    }
    
    // Priority 2: files array - look for WAV or high quality format
    if (!downloadUrl && sfx.files && sfx.files.length > 0) {
      log('📦 Available SFX files:', sfx.files.map(f => `${f.fileFormat} - ${f.fileName}`));
      
      // IMPORTANT: Filter AUDIO files only (exclude video)
      const audioFiles = sfx.files.filter(f => {
        const format = (f.fileFormat || '').toUpperCase();
        const filename = (f.fileName || '').toLowerCase();
        // Only include audio formats, exclude video
        const isAudio = ['WAV', 'AAC', 'MP3', 'FLAC', 'OGG', 'M4A'].includes(format) ||
                       filename.endsWith('.wav') || filename.endsWith('.aac') || 
                       filename.endsWith('.mp3') || filename.endsWith('.flac');
        const isVideo = ['MP4', 'MOV', 'AVI', 'WEBM'].includes(format) ||
                       filename.endsWith('.mp4') || filename.endsWith('.mov');
        return isAudio && !isVideo;
      });
      
      log('🎵 SFX Audio files only:', audioFiles.map(f => f.fileFormat));
      
      const wavFile = audioFiles.find(f => f.fileFormat === 'WAV' || f.fileFormat === 'wav');
      const aacFile = audioFiles.find(f => f.fileFormat === 'AAC' || f.fileFormat === 'aac');
      const mp3File = audioFiles.find(f => f.fileFormat === 'MP3' || f.fileFormat === 'mp3');
      
      const preferredFile = wavFile || aacFile || mp3File || audioFiles[0];
      if (preferredFile) {
        // Try downloadFilePath first, then filePath
        downloadUrl = preferredFile.downloadFilePath || preferredFile.filePath;
        if (downloadUrl) {
          log('✅ SFX - Using files.downloadFilePath:', preferredFile.fileFormat, downloadUrl);
        }
      }
    }
    
    // Priority 3: Fallback to playable file (preview quality)
    if (!downloadUrl) {
      downloadUrl = sfx.waveform?.playableFileUrl || sfx.sitePlayableFilePath;
      log('⚠️ SFX - Using fallback playableFileUrl (preview quality):', downloadUrl);
    }
    
    log('🔊 FINAL SFX DOWNLOAD URL:', downloadUrl);
    
    return {
      songId: sfx.sfxId,
      songName: sfx.sfxName,
      artistId: '',
      artistName: 'Artlist',
      albumId: '',
      albumName: sfx.sfxName,
      sitePlayableFilePath: downloadUrl,
      isSfx: true
    };
  } catch (err) {
    error('API error:', err);
    return null;
  }
}

async function scrapeSongDataFromPage() {
  try {
    let songId = '';
    let title = '';
    let artistName = 'Unknown';
    let artistId = '';
    let isSfx = false;
    
    // Check type
    if (window.location.pathname.includes('/sfx/') || window.location.pathname.includes('/sound-effects/')) {
      isSfx = true;
    }
    
    // Try modal
    const modal = document.querySelector('[role="dialog"]') || 
                  document.querySelector('[data-testid="Modal"]');
    
    if (modal) {
      const songLink = modal.querySelector('a[href*="/song/"], a[href*="/sfx/"]');
      if (songLink) {
        const href = songLink.getAttribute('href');
        const parts = href.split('/');
        songId = parts[parts.length - 1];
        title = songLink.textContent?.trim() || '';
        
        if (href.includes('/sfx/')) isSfx = true;
      }
      
      const artistLink = modal.querySelector('a[href*="/artist/"]');
      if (artistLink) {
        artistName = artistLink.textContent?.trim() || 'Unknown';
        const href = artistLink.getAttribute('href');
        const parts = href.split('/');
        artistId = parts[parts.length - 1];
      }
    }
    
    // Try URL
    if (!songId) {
      const urlParts = window.location.pathname.split('/');
      songId = urlParts[urlParts.length - 1];
      
      const titleElement = document.querySelector('h1');
      if (titleElement) {
        title = titleElement.textContent.trim();
      }
    }
    
    if (!songId || !title) return null;
    
    // Find audio URL
    let audioUrl = null;
    const audioElement = document.querySelector('audio');
    if (audioElement && audioElement.src) {
      audioUrl = audioElement.src;
    }
    
    if (!audioUrl && window.performance) {
      const resources = performance.getEntriesByType('resource');
      const audioResources = resources.filter(r => 
        r.name.includes('.aac') || 
        r.name.includes('.m4a') || 
        r.name.includes('.wav') ||
        r.name.includes('cms-public-artifacts')
      );
      
      if (audioResources.length > 0) {
        audioUrl = audioResources[audioResources.length - 1].name;
      }
    }
    
    if (!audioUrl) return null;
    
    return {
      songId: songId,
      songName: title,
      artistId: artistId,
      artistName: isSfx ? 'Artlist' : artistName,
      albumId: '',
      albumName: title,
      sitePlayableFilePath: audioUrl,
      isSfx: isSfx
    };
    
  } catch (err) {
    error('Scraping error:', err);
    return null;
  }
}
