// ============================================
// Live device status — time, battery, GPS
// ============================================
(function() {
  'use strict';

  function updateTime() {
    var now = new Date();
    var h = now.getHours();
    var m = String(now.getMinutes()).padStart(2, '0');
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    var timeStr = h12 + ':' + m;
    document.querySelectorAll('.status-bar span:first-child').forEach(function(el) {
      el.textContent = timeStr;
    });
  }

  function updateBattery() {
    if (!navigator.getBattery) {
      // Fallback: show signal + generic battery
      document.querySelectorAll('.status-bar span:last-child').forEach(function(el) {
        el.innerHTML = '📶 🔋 100%';
      });
      return;
    }
    navigator.getBattery().then(function(b) {
      var level = Math.round(b.level * 100);
      var icon = level >= 90 ? '🔋' : level >= 40 ? '🔋' : '🪫';
      document.querySelectorAll('.status-bar span:last-child').forEach(function(el) {
        el.innerHTML = '📶 ' + icon + ' ' + level + '%';
      });
      b.addEventListener('levelchange', updateBattery);
    }).catch(function() {
      document.querySelectorAll('.status-bar span:last-child').forEach(function(el) {
        el.innerHTML = '📶 🔋 100%';
      });
    });
  }

  // GPS: store last known position on window for other modules
  function initGPS() {
    if (!navigator.geolocation) {
      console.log('GPS not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        window.userPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        console.log('📍 GPS acquired:', window.userPosition);
        localStorage.setItem('userPosition', JSON.stringify(window.userPosition));
      },
      function(err) {
        console.log('GPS denied or unavailable:', err.message);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  function init() {
    updateTime();
    setInterval(updateTime, 30000);
    updateBattery();
    initGPS();
    console.log('✅ device-status initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();