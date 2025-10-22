document.addEventListener('DOMContentLoaded', function() {
  const urlInput = document.getElementById('urlInput');
  const downloadBtn = document.getElementById('downloadBtn');
  const downloadCurrentBtn = document.getElementById('downloadCurrentBtn');
  const status = document.getElementById('status');
  const btnText = document.getElementById('btnText');
  const btnLoader = document.getElementById('btnLoader');
  const currentBtnText = document.getElementById('currentBtnText');
  const currentBtnLoader = document.getElementById('currentBtnLoader');

  // Lấy URL từ tab hiện tại nếu đang ở trang Artlist
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentUrl = tabs[0].url;
    if (currentUrl && currentUrl.includes('artlist.io')) {
      urlInput.value = currentUrl;
    }
  });

  // XỬ LÝ NÚT MỚI: Tải bài đang phát
  downloadCurrentBtn.addEventListener('click', async function() {
    try {
      setLoadingCurrent(true);
      showStatus('Đang lấy thông tin bài đang phát...', 'info');

      let songInfo = await getCurrentPlayingSong();

      if (!songInfo) {
        showStatus('Không tìm thấy bài hát đang phát. Vui lòng phát một bài hát!', 'error');
        setLoadingCurrent(false);
        return;
      }

      // Nếu không có audio URL, cần gọi API để lấy link tải
      if (!songInfo.sitePlayableFilePath && songInfo.songId) {
        showStatus('Đang lấy link tải...', 'info');
        
        const fullSongInfo = await getSongInfoViaContentScript(songInfo.songId);
        
        if (fullSongInfo && fullSongInfo.sitePlayableFilePath) {
          songInfo = { ...songInfo, ...fullSongInfo };
        } else {
          showStatus('Không thể lấy link tải! Vui lòng thử phát nhạc và thử lại.', 'error');
          setLoadingCurrent(false);
          return;
        }
      }

      showStatus('Đang tải xuống...', 'info');

      const filename = makeFilename(songInfo);
      const downloadUrl = songInfo.sitePlayableFilePath;

      if (!downloadUrl) {
        showStatus('Không tìm thấy link tải!', 'error');
        setLoadingCurrent(false);
        return;
      }

      // Tải file
      chrome.downloads.download({
        url: downloadUrl,
        filename: filename + '.aac',
        saveAs: false
      }, function(downloadId) {
        if (chrome.runtime.lastError) {
          showStatus('Lỗi: ' + chrome.runtime.lastError.message, 'error');
          setLoadingCurrent(false);
        } else {
          showStatus(`Đang tải xuống ...`, 'success');
          setLoadingCurrent(false);
        }
      });

    } catch (error) {
      console.error('Error:', error);
      showStatus('Lỗi: ' + error.message, 'error');
      setLoadingCurrent(false);
    }
  });

  // XỬ LÝ NÚT CŨ: Tải từ link
  downloadBtn.addEventListener('click', async function() {
    const url = urlInput.value.trim();
    
    if (!url) {
      showStatus('Vui lòng nhập link Artlist!', 'error');
      return;
    }

    if (!isValidArtlistUrl(url)) {
      showStatus('Link không hợp lệ! Vui lòng nhập link bài hát từ Artlist.io', 'error');
      return;
    }

    try {
      setLoading(true);
      showStatus('Đang lấy thông tin bài hát...', 'info');

      const songId = extractSongId(url);
      const songInfo = await getSongInfoViaContentScript(songId);

      if (!songInfo) {
        showStatus('Không thể lấy thông tin! Vui lòng REFRESH trang Artlist và thử lại.', 'error');
        setLoading(false);
        return;
      }

      showStatus('Đang tải xuống...', 'info');

      const filename = makeFilename(songInfo);
      const downloadUrl = songInfo.sitePlayableFilePath;

      if (!downloadUrl) {
        showStatus('Không tìm thấy link tải! Vui lòng PHÁT NHẠC trên trang Artlist trước.', 'error');
        setLoading(false);
        return;
      }

      // Tải file bằng Chrome Downloads API
      chrome.downloads.download({
        url: downloadUrl,
        filename: filename + '.aac',
        saveAs: false
      }, function(downloadId) {
        if (chrome.runtime.lastError) {
          showStatus('Lỗi: ' + chrome.runtime.lastError.message, 'error');
          setLoading(false);
        } else {
          showStatus(`✓ Đang tải: ${songInfo.songName}`, 'success');
          setLoading(false);
        }
      });

    } catch (error) {
      console.error('Error:', error);
      showStatus('Lỗi: ' + error.message, 'error');
      setLoading(false);
    }
  });

  async function getCurrentPlayingSong() {
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
          action: 'getCurrentSong'
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Content script error:', chrome.runtime.lastError);
            reject(new Error('Không thể kết nối với trang. Vui lòng refresh trang!'));
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            console.error('Failed to get current song:', response?.error);
            reject(new Error(response?.error || 'Không thể lấy thông tin bài hát đang phát'));
          }
        });
      });
    });
  }

  function isValidArtlistUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('artlist.io') && 
             url.includes('/royalty-free-music/song/');
    } catch {
      return false;
    }
  }

  function extractSongId(url) {
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
    const noAlbum = songData.albumId === undefined;
    const albumPart = songData.songName !== songData.albumName ? `on ${songData.albumName} ` : '';
    const albumIdPart = noAlbum ? '' : songData.albumId + '.';
    
    return `Music ${songData.artistName} - ${songData.songName} ${albumPart}(${songData.artistId}.${albumIdPart}${songData.songId})`;
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

  function setLoadingCurrent(loading) {
    downloadCurrentBtn.disabled = loading;
    if (loading) {
      currentBtnText.classList.add('hidden');
      currentBtnLoader.classList.remove('hidden');
    } else {
      currentBtnText.classList.remove('hidden');
      currentBtnLoader.classList.add('hidden');
    }
  }
});
