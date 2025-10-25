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
let lastPlayedSong = null; // NEW: Track last played song (even if stopped)
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
    
    // PRIORITY: Try all methods to find audio element
    let audioElement = document.querySelector('audio');
    
    // Method 1: Direct audio element
    if (!audioElement) {
      // Try in shadow DOM
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.shadowRoot) {
          const shadowAudio = el.shadowRoot.querySelector('audio');
          if (shadowAudio && shadowAudio.src) {
            audioElement = shadowAudio;
            log('🎵 Found audio in shadow DOM');
            break;
          }
        }
      }
    }
    
    // Method 2: Look in player containers
    if (!audioElement) {
      const playerContainers = [
        '[data-testid="MusicPlayer"]',
        '[data-testid="AudioPlayer"]',
        'footer',
        '[class*="player" i]',
        '[class*="Player"]'
      ];
      
      for (const selector of playerContainers) {
        const container = document.querySelector(selector);
        if (container) {
          audioElement = container.querySelector('audio');
          if (audioElement && audioElement.src) {
            log('🎵 Found audio in', selector);
            break;
          }
        }
      }
    }
    
    if (audioElement && (audioElement.src || audioElement.currentSrc)) {
      audioUrl = audioElement.currentSrc || audioElement.src || '';
      log('🎵 Audio element found!');
      log('🎵 Audio URL:', audioUrl ? audioUrl.substring(0, 100) + '...' : 'EMPTY');
      log('🎵 Audio paused:', audioElement.paused);
      log('🎵 Audio currentTime:', audioElement.currentTime);
      log('🎵 Audio duration:', audioElement.duration);
    } else {
      log('❌ No audio element found, trying performance API...');
      log('🔍 Trying performance API to find audio file...');
      
      // Fallback: Try to find audio URL from performance/network resources - ONLY FROM ARTLIST
      if (window.performance) {
        const resources = performance.getEntriesByType('resource');
        const audioResources = resources.filter(r => {
          const url = r.name || '';
          // MUST be from Artlist domains AND be audio file
          const isArtlistDomain = url.includes('artlist.io') || url.includes('cms-public-artifacts');
          const isAudioFile = url.includes('.aac') || url.includes('.m4a') || 
                             url.includes('.mp3') || url.includes('.wav');
          return isArtlistDomain && isAudioFile;
        });
        
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
    
    // SMART MERGE: Preserve instant detection data when possible
    const updatedData = {
      ...songInfo,
      sitePlayableFilePath: audioUrl,
      detectedAt: Date.now()
    };
    
    // CRITICAL: If currentPlayingSong has a specific name but songInfo doesn't, keep the old one
    if (currentPlayingSong && currentPlayingSong.songId === songInfo.songId) {
      // Keep existing name if it's better than new detection
      const hasGoodExistingName = currentPlayingSong.songName && 
                                  currentPlayingSong.songName !== 'Unknown' &&
                                  currentPlayingSong.songName !== 'SFX Audio' &&
                                  currentPlayingSong.songName !== 'Unknown Audio';
      
      const hasGenericNewName = !songInfo.songName || 
                               songInfo.songName === 'Unknown' ||
                               songInfo.songName === 'SFX Audio' ||
                               songInfo.songName === 'Unknown Audio';
      
      if (hasGoodExistingName && hasGenericNewName) {
        log('📝 PRESERVING existing good name:', currentPlayingSong.songName);
        updatedData.songName = currentPlayingSong.songName;
        updatedData.albumName = currentPlayingSong.albumName || songInfo.songName;
        updatedData.artistName = currentPlayingSong.artistName || songInfo.artistName;
      }
    }
    
    currentPlayingSong = updatedData;
    
    // IMPORTANT: Also save to lastPlayedSong (persists even after audio stops)
    lastPlayedSong = { ...currentPlayingSong };
    
    log('💾 Current playing saved:', currentPlayingSong.songName);
    log('💾 Last played saved:', lastPlayedSong.songName);
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
    
    // CRITICAL: Detect multiple times on play for short SFX
    audio.addEventListener('play', () => {
      setTimeout(() => detectCurrentSong(), 50);   // Immediate
      setTimeout(() => detectCurrentSong(), 200);  // Quick
      setTimeout(() => detectCurrentSong(), 500);  // Normal
    });
    
    audio.addEventListener('loadeddata', () => {
      setTimeout(() => detectCurrentSong(), 100);
      setTimeout(() => detectCurrentSong(), 500);
    });
    
    audio.addEventListener('canplay', () => {
      setTimeout(() => detectCurrentSong(), 100);
      setTimeout(() => detectCurrentSong(), 400);
    });
    
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
  let lastClearedTime = 0;
  
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
          
          // CRITICAL: Clear old captured URLs EVERY time audio changes
          // This prevents downloading wrong song/SFX when switching tracks
          const now = Date.now();
          log('🗑️ Clearing old captured URLs for new audio');
          if (window._artlistDownloadUrls) {
            // Keep only very recent URLs (last 5 seconds)
            const before = window._artlistDownloadUrls.length;
            window._artlistDownloadUrls = window._artlistDownloadUrls.filter(item => {
              const age = (now - item.timestamp) / 1000;
              return age < 5;
            });
            const after = window._artlistDownloadUrls.length;
            if (before !== after) {
              log(`   Cleared ${before - after} old URLs, kept ${after} recent ones`);
            }
          }
          lastClearedTime = now;
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
      
      if (songLink) {
        songName = songLink.textContent?.trim() || songLink.innerText?.trim() || '';
        const href = songLink.getAttribute('href') || '';
        const parts = href.split('/');
        songId = parts[parts.length - 1].split('?')[0];
        
        if (href.includes('/sfx/')) {
          isSfx = true;
        }
      }
      
      // Get artist - try multiple methods
      if (!isSfx) {
        // Method 1: Direct artist link in player bar
        const artistLink = playerBar.querySelector('a[href*="/artist/"]');
        if (artistLink) {
          artistName = artistLink.textContent?.trim() || artistLink.innerText?.trim() || '';
        }
        
        // Method 2: Look for text between song name and other elements
        if (!artistName && songLink) {
          // Try to find sibling text or parent text
          const parent = songLink.closest('div, span, a');
          if (parent) {
            const textContent = parent.textContent || '';
            // Artist name usually appears after " - " or "by "
            const byMatch = textContent.match(/(?:by|By)\s+([^-•|]+)/);
            if (byMatch) {
              artistName = byMatch[1].trim();
            }
          }
        }
      }
      
      if (songName) {
        log('📝 Detected from player bar:', { songName, artistName, songId, isSfx });
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
      const audioResources = resources.filter(r => {
        const url = r.name || '';
        // MUST be from Artlist domains AND be audio file
        const isArtlistDomain = url.includes('artlist.io') || url.includes('cms-public-artifacts');
        const isAudioFile = url.includes('.aac') || url.includes('.m4a') || url.includes('.mp3');
        return isArtlistDomain && isAudioFile;
      });
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

// Monitor play button clicks (for quick detection - especially for short SFX)
document.addEventListener('click', function(e) {
  // Check if clicked element is a play button
  const target = e.target;
  const button = target.closest('button');
  
  if (button) {
    const isPlayButton = button.querySelector('svg[data-icon="play"]') ||
                        button.querySelector('[class*="play" i]') ||
                        button.getAttribute('aria-label')?.toLowerCase().includes('play') ||
                        button.getAttribute('title')?.toLowerCase().includes('play');
    
    if (isPlayButton) {
      log('▶️ Play button clicked, detecting song immediately...');
      
      // IMMEDIATE: Try to get song info from the clicked row (for short SFX)
      try {
        // Try multiple methods to find the row/container
        let container = button.closest('tr') || 
                       button.closest('div[role="row"]') || 
                       button.closest('div[class*="row" i]') ||
                       button.closest('div[class*="Row"]') ||
                       button.closest('div[class*="item" i]') ||
                       button.closest('div[class*="Item"]') ||
                       button.closest('li');
        
        // If still not found, try parent elements
        if (!container) {
          let el = button;
          for (let i = 0; i < 10 && el; i++) { // Search up to 10 levels
            el = el.parentElement;
            if (el && el.querySelector('a[href*="/sfx/"], a[href*="/track/"], a[href*="/song/"]')) {
              container = el;
              break;
            }
          }
        }
        
        if (container) {
          log('📦 Found container for play button');
          
          // Try to find song/SFX link
          const songLink = container.querySelector('a[href*="/song/"]') || 
                          container.querySelector('a[href*="/sfx/"]') ||
                          container.querySelector('a[href*="/track/"]');
          
          if (songLink) {
            const songName = songLink.textContent?.trim() || songLink.innerText?.trim() || '';
            const href = songLink.getAttribute('href') || '';
            const parts = href.split('/');
            const songId = parts[parts.length - 1].split('?')[0];
            const isSfx = href.includes('/sfx/') || href.includes('/track/') || 
                         window.location.pathname.includes('/sfx');
            
            // Also try to get artist name
            let artistName = isSfx ? 'Artlist' : 'Unknown Artist';
            const artistLink = container.querySelector('a[href*="/artist/"]');
            if (artistLink) {
              artistName = artistLink.textContent?.trim() || artistLink.innerText?.trim() || artistName;
            }
            
            if (songName && songId) {
              log('⚡ INSTANT detection from clicked container:');
              log('   Name:', songName);
              log('   ID:', songId);
              log('   Artist:', artistName);
              
              // Save immediately
              const instantData = {
                songId: songId,
                songName: songName,
                artistId: '',
                artistName: artistName,
                albumId: '',
                albumName: songName,
                isSfx: isSfx,
                sitePlayableFilePath: '', // Will be updated by normal detection
                detectedAt: Date.now()
              };
              
              currentPlayingSong = instantData;
              lastPlayedSong = { ...instantData };
              
              log('💾 Instant save complete');
            } else {
              log('⚠️ Found link but missing name or ID');
            }
          } else {
            log('⚠️ No song/SFX link found in container');
          }
        } else {
          log('⚠️ Could not find container for play button');
        }
      } catch (err) {
        warn('Instant detection failed:', err);
      }
      
      // Still do normal detection to get audio URL
      setTimeout(() => {
        detectCurrentSong();
      }, 100); // Reduced from 300ms
      
      // Also detect again after audio might have loaded
      setTimeout(() => {
        detectCurrentSong();
      }, 800); // Reduced from 1000ms
    }
  }
}, true); // Use capture phase to catch early

log('🎯 Play button click monitor installed');

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
      
      // CRITICAL: Intercept ONLY real media URLs (not API endpoints)
      if (xhr._url && (
          (xhr._url.includes('cms-public-artifacts') && 
           (xhr._url.includes('.aac') || xhr._url.includes('.wav') || 
            xhr._url.includes('.mp3') || xhr._url.includes('.m4a'))) ||
          (xhr._url.includes('/files/') && 
           (xhr._url.includes('.aac') || xhr._url.includes('.wav') || 
            xhr._url.includes('.mp3') || xhr._url.includes('.m4a')))
      )) {
        // Double check: not graphql or json
        if (!xhr._url.includes('graphql') && !xhr._url.includes('.json')) {
          log('🎯 XHR Media URL intercepted:', xhr._url.substring(0, 120) + '...');
          if (!window._artlistDownloadUrls) {
            window._artlistDownloadUrls = [];
          }
          window._artlistDownloadUrls.push({
            url: xhr._url,
            timestamp: Date.now(),
            method: 'XHR'
          });
          // Keep last 30 URLs
          if (window._artlistDownloadUrls.length > 30) {
            window._artlistDownloadUrls.shift();
          }
        }
      }
    });
    
    return oldXHRSend.apply(this, arguments);
  };
  
  log('🔧 XHR interceptor installed');
})();

// Fetch API Interceptor
(function() {
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    
    // CRITICAL: Intercept ONLY real media URLs (not API endpoints)
    if (typeof url === 'string' && (
        (url.includes('cms-public-artifacts') && 
         (url.includes('.aac') || url.includes('.wav') || 
          url.includes('.mp3') || url.includes('.m4a'))) ||
        (url.includes('/files/') && 
         (url.includes('.aac') || url.includes('.wav') || 
          url.includes('.mp3') || url.includes('.m4a')))
    )) {
      // Double check: not graphql or json
      if (!url.includes('graphql') && !url.includes('.json')) {
        log('🎯 Fetch Media URL intercepted:', url.substring(0, 120) + '...');
        if (!window._artlistDownloadUrls) {
          window._artlistDownloadUrls = [];
        }
        window._artlistDownloadUrls.push({
          url: url,
          timestamp: Date.now(),
          method: 'Fetch'
        });
        if (window._artlistDownloadUrls.length > 30) {
          window._artlistDownloadUrls.shift();
        }
      }
    }
    
    return originalFetch.apply(this, args);
  };
  
  log('🔧 Fetch interceptor installed');
})();

// Performance Observer to catch audio URLs loaded via other methods
(function() {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const url = entry.name;
        if (url && (
            url.includes('cms-public-artifacts') ||
            (url.includes('.aac') || url.includes('.wav') || 
             url.includes('.mp3') || url.includes('.m4a'))
        )) {
          log('📊 Performance API captured audio URL:', url.substring(0, 120) + '...');
          if (!window._artlistDownloadUrls) {
            window._artlistDownloadUrls = [];
          }
          
          // Check if already captured
          const exists = window._artlistDownloadUrls.some(item => item.url === url);
          if (!exists) {
            window._artlistDownloadUrls.push({
              url: url,
              timestamp: Date.now(),
              method: 'Performance'
            });
            if (window._artlistDownloadUrls.length > 20) {
              window._artlistDownloadUrls.shift();
            }
          }
        }
      }
    });
    
    observer.observe({ entryTypes: ['resource'] });
    log('🔧 Performance Observer installed');
  } catch (e) {
    warn('Failed to install Performance Observer:', e);
  }
})();

// Message handlers

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
    // CRITICAL: Give instant detection time to complete before responding
    // Small delay ensures instant save completes before we read the data
    setTimeout(() => {
      // Force detection update (but don't wait for slow parts)
      detectCurrentSong();
      
      // PRIORITY 1: Use currentPlayingSong if available
      // PRIORITY 2: Use lastPlayedSong (even if audio stopped - for short SFX)
      const songToUse = currentPlayingSong || lastPlayedSong;
      
      if (songToUse && songToUse.songName) {
        log('🎵 Responding with:', songToUse.songName, 
            '(source:', currentPlayingSong ? 'currently playing' : 'last played', ')');
        
        // Return immediately what we have - popup will handle URL fetching if needed
        sendResponse({ success: true, data: songToUse });
      } else {
        sendResponse({ 
          success: false, 
          error: 'No audio playing. Please play something first!' 
        });
      }
    }, 200); // 200ms delay - balance between speed and accuracy
    
    return true; // Keep channel open for async response
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
  // FOR SONGS: Use timing-based matching with safety checks
  // Songs don't have strict ID matching requirements but still need timing validation
  if (!window._artlistDownloadUrls || window._artlistDownloadUrls.length === 0) {
    return null;
  }
  
  const now = Date.now();
  const recentUrls = window._artlistDownloadUrls.filter(item => {
    // Only use URLs from last 60 seconds
    return (now - item.timestamp) < 60000;
  });
  
  if (recentUrls.length === 0) return null;
  
  // PRIORITY 1: Try to find URL that contains the audio ID
  const matchingUrl = recentUrls.find(item => item.url.includes(audioId));
  if (matchingUrl) {
    log('✅ Found exact matching URL for song ID:', audioId);
    return matchingUrl.url;
  }
  
  // PRIORITY 2: For songs, allow fallback BUT only if very recent (< 10s)
  // This prevents downloading wrong song when switching between songs
  const mostRecent = recentUrls[recentUrls.length - 1];
  const ageSeconds = (now - mostRecent.timestamp) / 1000;
  
  if (ageSeconds < 10) {
    log(`📍 Using most recent URL for song (${ageSeconds.toFixed(1)}s old):`, mostRecent.url.substring(0, 100) + '...');
    return mostRecent.url;
  } else {
    log(`⚠️ Most recent URL too old (${ageSeconds.toFixed(1)}s), not using it`);
    return null;
  }
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
  
  // Priority 3: Fallback to playable URL - ONLY IF VALID
  if (!downloadUrl) {
    const fallbackUrl = song.waveform?.playableFileUrl || song.sitePlayableFilePath;
    if (fallbackUrl && (
        fallbackUrl.includes('.aac') || 
        fallbackUrl.includes('.wav') || 
        fallbackUrl.includes('.mp3') ||
        fallbackUrl.includes('.m4a') ||
        fallbackUrl.includes('cms-public-artifacts')
    )) {
      downloadUrl = fallbackUrl;
    }
  }
  
  // Validate URL
  if (downloadUrl && (downloadUrl.includes('graphql') || downloadUrl.includes('.json'))) {
    downloadUrl = null;
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
  
  // Priority 3: Fallback to playable URL - ONLY IF VALID
  if (!downloadUrl) {
    const fallbackUrl = sfx.waveform?.playableFileUrl || sfx.sitePlayableFilePath;
    if (fallbackUrl && (
        fallbackUrl.includes('.aac') || 
        fallbackUrl.includes('.wav') || 
        fallbackUrl.includes('.mp3') ||
        fallbackUrl.includes('.m4a') ||
        fallbackUrl.includes('cms-public-artifacts')
    )) {
      downloadUrl = fallbackUrl;
    }
  }
  
  // Validate URL
  if (downloadUrl && (downloadUrl.includes('graphql') || downloadUrl.includes('.json'))) {
    downloadUrl = null;
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
    log('🌐 Fetching song from API...');
    
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

    const response = await fetch('https://search-api.artlist.io/v1/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        variables: { ids: [songId.toString()] }
      })
    });

    if (!response.ok) {
      log('❌ API response not OK:', response.status);
      return null;
    }
    
    const data = await response.json();
    if (data.errors) {
      log('❌ GraphQL errors:', data.errors);
      return null;
    }
    
    const song = data.data?.songs?.[0];
    if (!song) {
      log('❌ No song data in response');
      return null;
    }
    
    log('📦 Song API Response:', {
      songId: song.songId,
      songName: song.songName,
      artistName: song.artistName,
      sitePlayableFilePath: song.sitePlayableFilePath
    });
    
    return song;
  } catch (err) {
    error('API error:', err);
    return null;
  }
}

async function fetchSfxFromPageContext(sfxId) {
  try {
    log('🌐 Fetching SFX, ID:', sfxId);
    
    // Get detection timestamp from current/last played song
    const songData = currentPlayingSong || lastPlayedSong;
    const detectedAt = songData?.detectedAt;
    
    // PRIORITY 1: Check captured URLs from network (BEST quality)
    const capturedUrl = getMostRecentCapturedUrl(sfxId, detectedAt);
    if (capturedUrl) {
      log('✅ Using captured URL from network:', capturedUrl.substring(0, 80) + '...');
      
      const uiInfo = extractSongInfoFromUI();
      
      return {
        songId: sfxId,
        songName: uiInfo?.songName || 'SFX Audio',
        artistId: '',
        artistName: uiInfo?.artistName || 'Artlist',
        albumId: '',
        albumName: uiInfo?.songName || 'SFX',
        sitePlayableFilePath: capturedUrl,
        isSfx: true
      };
    }
    
    // PRIORITY 2: For SFX, try to get URL from currently playing audio
    const playingUrl = await tryGetPlayingAudioUrl();
    if (playingUrl) {
      log('✅ Got SFX URL from playing audio:', playingUrl);
      
      // Get name from UI
      const uiInfo = extractSongInfoFromUI();
      
      return {
        songId: sfxId,
        songName: uiInfo?.songName || 'SFX Audio',
        artistId: '',
        artistName: uiInfo?.artistName || 'Artlist',
        albumId: '',
        albumName: uiInfo?.songName || 'SFX',
        sitePlayableFilePath: playingUrl,
        isSfx: true
      };
    }
    
    // Fallback: Try API (but this usually returns preview URL for SFX)
    log('⚠️ No playing audio found, trying API (may be preview quality)...');
    
    const query = `query Sfxs($ids: [Int!]!) {
      sfxs(ids: $ids) {
        sfxId
        sfxName
        duration
        sitePlayableFilePath
      }
    }`;

    const response = await fetch('https://search-api.artlist.io/v1/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        variables: { ids: [parseInt(sfxId)] }
      })
    });

    if (!response.ok) {
      log('❌ SFX API response not OK:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.errors) {
      log('❌ SFX GraphQL errors:', data.errors);
      return null;
    }
    
    const sfx = data.data?.sfxs?.[0];
    if (!sfx) {
      log('❌ No SFX data in response');
      return null;
    }
    
    log('⚠️ Using API URL (preview quality):', sfx.sitePlayableFilePath);
    
    return {
      songId: sfx.sfxId,
      songName: sfx.sfxName,
      artistId: '',
      artistName: 'Artlist',
      albumId: '',
      albumName: sfx.sfxName,
      sitePlayableFilePath: sfx.sitePlayableFilePath,
      isSfx: true
    };
  } catch (err) {
    error('❌ SFX fetch error:', err);
    return null;
  }
}

// Helper: Get most recent captured URL for an audio ID
function getMostRecentCapturedUrl(audioId, detectedAt) {
  log('🔍 Searching for captured URL, audioId:', audioId, 'detectedAt:', detectedAt);
  
  // FIRST: Scan Performance API for any missed URLs
  scanPerformanceAPIForAudioUrls();
  
  if (!window._artlistDownloadUrls) {
    log('❌ No _artlistDownloadUrls array found');
    return null;
  }
  
  if (window._artlistDownloadUrls.length === 0) {
    log('❌ _artlistDownloadUrls is empty');
    return null;
  }
  
  log(`📦 Total captured URLs: ${window._artlistDownloadUrls.length}`);
  window._artlistDownloadUrls.forEach((item, i) => {
    log(`  [${i}] ${item.url.substring(0, 100)}... (${item.method}, ${Math.floor((Date.now() - item.timestamp) / 1000)}s ago)`);
  });
  
  const now = Date.now();
  const recentUrls = window._artlistDownloadUrls.filter(item => {
    // Only use URLs from last 60 seconds
    const age = (now - item.timestamp) / 1000;
    const isRecent = age < 60;
    
    // CRITICAL: If we have detectedAt timestamp, only use URLs captured AFTER detection
    // This prevents using URLs from previous audio
    if (detectedAt && item.timestamp < detectedAt) {
      log(`⏰ Skipping URL captured before detection (${item.timestamp} < ${detectedAt})`);
      return false;
    }
    
    if (!isRecent) {
      log(`⏰ Skipping old URL (${age.toFixed(0)}s old)`);
    }
    return isRecent;
  });
  
  if (recentUrls.length === 0) {
    log('❌ No recent URLs found (all older than 60s or before detection)');
    return null;
  }
  
  log(`✅ Found ${recentUrls.length} recent URLs after detection`);
  
  // IMPORTANT: Filter out invalid URLs (graphql, json, etc)
  const validAudioUrls = recentUrls.filter(item => {
    const url = item.url;
    const isValid = !url.includes('graphql') && 
                   !url.includes('.json') && 
                   !url.includes('/api/') &&
                   (url.includes('.aac') || url.includes('.wav') || 
                    url.includes('.mp3') || url.includes('.m4a') ||
                    url.includes('cms-public-artifacts'));
    
    if (!isValid) {
      log(`🚫 Skipping invalid URL: ${url.substring(0, 80)}...`);
    }
    return isValid;
  });
  
  if (validAudioUrls.length === 0) {
    log('❌ No valid audio URLs found after filtering');
    return null;
  }
  
  log(`✅ Found ${validAudioUrls.length} valid audio URLs`);
  
  // Try to find URL that contains the audio ID
  const idStr = audioId.toString();
  log(`🔎 Looking for URL containing ID: "${idStr}"`);
  
  const matchingUrl = validAudioUrls.find(item => item.url.includes(idStr));
  if (matchingUrl) {
    log('🎯 Found matching URL for ID:', idStr);
    return matchingUrl.url;
  }
  
  // If no ID match but we have detectedAt, use MOST RECENT after detection
  // (Artlist URLs don't contain ID, so we rely on timing)
  if (detectedAt && validAudioUrls.length > 0) {
    const mostRecent = validAudioUrls[validAudioUrls.length - 1];
    log('📍 No ID in URL, using most recent URL captured after detection:', mostRecent.url.substring(0, 100) + '...');
    return mostRecent.url;
  }
  
  // CRITICAL: DO NOT fallback to most recent URL without timing check
  log(`❌ No URL contains ID "${idStr}" and no detectedAt timestamp, returning null`);
  return null;
}

// Helper: Scan Performance API for audio URLs
function scanPerformanceAPIForAudioUrls() {
  try {
    const resources = performance.getEntriesByType('resource');
    const audioResources = resources.filter(r => {
      const url = r.name || '';
      return (url.includes('cms-public-artifacts') && 
              (url.includes('.aac') || url.includes('.wav') || 
               url.includes('.mp3') || url.includes('.m4a')));
    });
    
    if (audioResources.length > 0) {
      log(`🔎 Found ${audioResources.length} audio URLs in Performance API`);
      
      if (!window._artlistDownloadUrls) {
        window._artlistDownloadUrls = [];
      }
      
      audioResources.forEach(resource => {
        const url = resource.name;
        // Only add if not already in array
        const exists = window._artlistDownloadUrls.some(item => item.url === url);
        if (!exists) {
          log('📊 Adding from Performance API:', url.substring(0, 100) + '...');
          window._artlistDownloadUrls.push({
            url: url,
            timestamp: Date.now(),
            method: 'PerformanceAPI'
          });
        }
      });
      
      // Keep last 30 URLs (increased from 20)
      if (window._artlistDownloadUrls.length > 30) {
        window._artlistDownloadUrls = window._artlistDownloadUrls.slice(-30);
      }
    }
  } catch (e) {
    warn('Error scanning Performance API:', e);
  }
}

// Helper: Try to get URL from currently playing audio
async function tryGetPlayingAudioUrl() {
  try {
    log('🔍 Trying to get playing audio URL...');
    
    // Method 1: Audio element - search everywhere including shadow DOM
    let audioElements = document.querySelectorAll('audio');
    
    // Also search in shadow DOMs
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        const shadowAudios = el.shadowRoot.querySelectorAll('audio');
        audioElements = [...audioElements, ...shadowAudios];
      }
    }
    
    // Also search in iframes
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeAudios = iframe.contentDocument?.querySelectorAll('audio') || [];
        audioElements = [...audioElements, ...iframeAudios];
      } catch (e) {
        // Cross-origin iframe, skip
      }
    }
    
    log(`Found ${audioElements.length} audio elements (including shadow DOM and iframes)`);
    
    for (const audio of audioElements) {
      const isPlaying = !audio.paused && audio.currentTime > 0;
      const srcUrl = audio.src || audio.currentSrc;
      
      log(`Audio element - playing: ${isPlaying}, paused: ${audio.paused}, currentTime: ${audio.currentTime}, src: ${srcUrl}`);
      
      if (srcUrl) {
        // Accept ANY non-blob URL from audio element
        if (!srcUrl.startsWith('blob:') && !srcUrl.startsWith('data:')) {
          log('✅ Found audio URL from audio element:', srcUrl);
          return srcUrl;
        } else {
          log('⚠️ Audio has blob/data URL:', srcUrl);
        }
      }
      
      // Check all source elements inside audio
      const sources = audio.querySelectorAll('source');
      for (const source of sources) {
        const sourceSrc = source.src || source.getAttribute('src');
        if (sourceSrc && !sourceSrc.startsWith('blob:')) {
          log('✅ Found URL from source element:', sourceSrc);
          return sourceSrc;
        }
      }
    }
    
    // Method 2: Check XHR intercepted URLs (PRIORITY for recent requests)
    log('🔍 Checking cached URLs...');
    if (window._artlistDownloadUrls && window._artlistDownloadUrls.length > 0) {
      log(`Found ${window._artlistDownloadUrls.length} cached URLs`);
      
      // Show all cached URLs for debugging
      window._artlistDownloadUrls.forEach((item, i) => {
        log(`  [${i}] ${new Date(item.timestamp).toLocaleTimeString()}: ${item.url}`);
      });
      
      // Get the most recent audio URL (within last 2 minutes)
      const recentUrls = window._artlistDownloadUrls
        .filter(item => Date.now() - item.timestamp < 120000)
        .sort((a, b) => b.timestamp - a.timestamp);
      
      if (recentUrls.length > 0) {
        const url = recentUrls[0].url;
        log('✅ Using most recent cached URL:', url);
        return url;
      }
    }
    
    // Method 3: Performance API - VERY aggressive search
    log('🔍 Trying performance API with aggressive search...');
    const resources = performance.getEntriesByType('resource');
    
    // Look for ANY Artlist CDN URLs
    const cdnResources = resources.filter(r => {
      const name = r.name.toLowerCase();
      const isCdn = name.includes('cms-public-artifacts.artlist.io');
      const notExcluded = !name.includes('.js') &&
                         !name.includes('.css') &&
                         !name.includes('.json') &&
                         !name.includes('.svg') &&
                         !name.includes('.png') &&
                         !name.includes('.jpg') &&
                         !name.includes('.webp') &&
                         !name.includes('.woff') &&
                         !name.includes('.ttf');
      
      return isCdn && notExcluded;
    }).sort((a, b) => b.startTime - a.startTime);
    
    log(`Found ${cdnResources.length} CDN resources`);
    
    if (cdnResources.length > 0) {
      log('🔍 All CDN resources found:');
      cdnResources.forEach((r, i) => log(`  [${i}]`, r.name));
      
      const url = cdnResources[0].name;
      log('✅ Using most recent CDN resource:', url);
      return url;
    }
    
    log('❌ No audio URL found from any method');
    return null;
  } catch (err) {
    error('Error getting playing audio URL:', err);
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
      const audioResources = resources.filter(r => {
        const url = r.name || '';
        // MUST be from Artlist domains AND be audio file
        const isArtlistDomain = url.includes('artlist.io') || url.includes('cms-public-artifacts');
        const isAudioFile = url.includes('.aac') || url.includes('.m4a') || 
                           url.includes('.wav') || url.includes('.mp3');
        return isArtlistDomain && isAudioFile;
      });
      
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

