// ============================================
// Providers Directory — cards with online status + filters
// ============================================
(function() {
  'use strict';

  
  var API = 'https://n-health-backend-production.up.railway.app';
  var PROVIDERS = [];  // populated from backend
  var state = { filter: 'ALL', sortBy: 'rating' };

  async function fetchProviders() {
    try {
      var token = localStorage.getItem('token');
      var res = await fetch(API + '/api/providers/list', {
        headers: { 'Authorization': 'Bearer ' + (token || '') },
      });
      if (!res.ok) {
        console.error('Failed to fetch providers:', res.status);
        return [];
      }
      var data = await res.json();
      console.log('Loaded ' + data.length + ' providers from backend');
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('Fetch providers error:', e);
      return [];
    }
  }


  var state = { filter: 'ALL', sortBy: 'rating' };

  function applySort(list) {
    var copy = list.slice();
    if (state.sortBy === 'rating') copy.sort(function(a, b) { return b.rating - a.rating; });
    else if (state.sortBy === 'experience') copy.sort(function(a, b) { return b.experience - a.experience; });
    else if (state.sortBy === 'location') copy.sort(function(a, b) { return a.location.localeCompare(b.location); });
    else if (state.sortBy === 'fee') copy.sort(function(a, b) { return a.fee - b.fee; });
    return copy;
  }

  function renderList(container) {
    if (!PROVIDERS || PROVIDERS.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px 0;"><div style="font-size:32px;">🔍</div><p style="color:var(--text-secondary);margin-top:8px;">No providers found</p></div>';
      return;
    }
    var list = PROVIDERS;
    if (state.filter !== 'ALL') list = list.filter(function(p) { return p.type === state.filter; });
    list = applySort(list);

    var cardsHTML = list.map(function(p) {
      var statusColor = p.online ? 'var(--success)' : 'var(--text-light)';
      var statusLabel = p.online ? '● Online' : '○ Offline';
      return '<div class="provider-card" data-id="' + p.id + '" style="border:1px solid #E8ECF1;border-radius:12px;padding:12px;margin-bottom:10px;cursor:pointer;transition:all 0.2s;">' +
        '<div style="display:flex;gap:10px;align-items:center;">' +
          '<div style="font-size:32px;">' + p.icon + '</div>' +
          '<div style="flex:1;">' +
            '<div style="font-weight:600;font-size:14px;">' + p.name + '</div>' +
            '<div style="font-size:12px;color:var(--text-secondary);">' + p.specialty + '</div>' +
            '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">' +
              '⭐ ' + p.rating + ' (' + p.reviews + ') • 📍 ' + p.location + ' • 🎓 ' + p.experience + ' yrs' +
            '</div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div style="font-size:11px;color:' + statusColor + ';font-weight:600;">' + statusLabel + '</div>' +
            (p.fee > 0 ? '<div style="font-size:12px;font-weight:700;color:var(--primary);margin-top:2px;">₦' + p.fee.toLocaleString() + '</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    container.innerHTML = cardsHTML;
    container.querySelectorAll('.provider-card').forEach(function(el) {
      el.addEventListener('click', function() {
        var p = PROVIDERS.find(function(x) { return x.id === el.dataset.id; });
        if (p) showProviderDetail(p);
      });
    });
  }

  function showProviderDetail(p) {
    var onlineBlock = p.online
      ? '<span class="badge badge-success">● Online — Available now</span>'
      : '<span class="badge badge-warning">○ Offline — Usually responds within 24h</span>';

    var actionLabel = (p.type === 'PHARMACY') ? '🛒 Explore' : '📅 Book Now';

    showModal(p.icon + ' ' + p.name,
      '<div style="text-align:center;padding:8px 0 12px;">' +
        '<div style="font-size:56px;">' + p.icon + '</div>' +
        '<div style="font-weight:600;font-size:15px;margin-top:4px;">' + p.name + '</div>' +
        '<div style="font-size:12px;color:var(--text-secondary);">' + p.specialty + '</div>' +
        '<div style="margin-top:6px;">' + onlineBlock + '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;background:var(--surface);border-radius:8px;font-size:12px;">' +
        '<div><div style="color:var(--text-light);font-size:10px;">Rating</div><div>⭐ ' + p.rating + ' (' + p.reviews + ' reviews)</div></div>' +
        '<div><div style="color:var(--text-light);font-size:10px;">Experience</div><div>' + p.experience + ' years</div></div>' +
        '<div><div style="color:var(--text-light);font-size:10px;">Location</div><div>' + p.location + '</div></div>' +
        '<div><div style="color:var(--text-light);font-size:10px;">Type</div><div>' + p.type + '</div></div>' +
        (p.fee > 0 ? '<div style="grid-column:span 2;"><div style="color:var(--text-light);font-size:10px;">Consultation Fee</div><div style="font-weight:700;color:var(--primary);font-size:14px;">₦' + p.fee.toLocaleString() + '</div></div>' : '') +
      '</div>',
      '<button class="btn btn-outline" onclick="closeModal()">Close</button>' +
      '<button class="btn btn-primary" onclick="window._bookProviderById(\'' + p.id + '\')">' + actionLabel + '</button>');
  }

  // ================================================
  // ROLE-BASED ROUTING
  // ================================================
  function routeBooking(p) {
    closeModal();
    var type = p.type;

    if (type === 'DOCTOR' || type === 'NURSE' || type === 'AMBULANCE') {
      // Appointment booking flow (with notes + payment)
      showToast('📅 Opening booking for ' + p.name);
      setTimeout(function() {
        var apptBtn = document.querySelector('#patient-nav button[data-screen="patient-appointments"]');
        if (apptBtn) apptBtn.click();
        setTimeout(function() {
          if (typeof window.bookAppointment === 'function') {
  window.bookAppointment(p.name, p.specialty, p.fee, p.userId);
} else {
            showToast('⚠️ Booking module loading...');
          }
        }, 400);
      }, 300);

    } else if (type === 'PHARMACY') {
      // Explore pharmacy inventory
      showToast('💊 ' + p.name + ' inventory');
      setTimeout(function() {
        var pharmBtn = document.querySelector('#patient-nav button[data-screen="patient-pharmacy"]');
        if (pharmBtn) pharmBtn.click();
        setTimeout(function() {
          var titleEl = document.querySelector('#patient-pharmacy .app-bar .title');
          if (titleEl) titleEl.innerHTML = '💊 <span>' + p.name + '</span>';
        }, 200);
      }, 200);

    } else if (type === 'LAB') {
      // Lab booking with services list
      if (typeof window.openLabBooking === 'function') {
        window.openLabBooking(p);
      } else {
        showToast('🔬 Lab booking loading...');
      }

    } else {
      showToast('Opening ' + p.name);
    }
  }

  window._bookProviderById = function(id) {
    var p = PROVIDERS.find(function(x) { return x.id === id; });
    if (p) routeBooking(p);
  };

  // ================================================
  // INJECT DIRECTORY INTO PROVIDERS SCREEN
  // ================================================
  async function injectDirectory() {
    PROVIDERS = await fetchProviders();
    var screen = document.getElementById('patient-providers');
    if (!screen || screen.dataset.dirInjected) return;
    screen.dataset.dirInjected = 'true';

    var padding = screen.querySelector('div[style*="padding"]');
    if (!padding) return;

    var filtersHTML =
      '<div style="display:flex;gap:6px;overflow-x:auto;padding:8px 0;margin-bottom:10px;">' +
        ['ALL','DOCTOR','PHARMACY','LAB','NURSE','AMBULANCE'].map(function(t) {
          return '<button class="filter-chip" data-filter="' + t + '" style="padding:6px 14px;border:1px solid #E8ECF1;border-radius:20px;background:white;font-size:12px;white-space:nowrap;cursor:pointer;">' + t + '</button>';
        }).join('') +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
        '<div style="font-size:12px;color:var(--text-secondary);">Sort by:</div>' +
        '<select id="sort-select" style="padding:4px 8px;border:1px solid #E8ECF1;border-radius:6px;font-size:12px;">' +
          '<option value="rating">⭐ Top Rated</option>' +
          '<option value="experience">🎓 Most Experienced</option>' +
          '<option value="location">📍 Location</option>' +
          '<option value="fee">💰 Lowest Fee</option>' +
        '</select>' +
      '</div>' +
      '<div id="providers-list-container"></div>';

    padding.innerHTML = filtersHTML;

    var container = document.getElementById('providers-list-container');
    renderList(container);

    document.querySelectorAll('.filter-chip').forEach(function(chip) {
      if (chip.dataset.filter === 'ALL') {
        chip.style.background = 'var(--primary)';
        chip.style.color = 'white';
        chip.style.borderColor = 'var(--primary)';
      }
      chip.addEventListener('click', function() {
        document.querySelectorAll('.filter-chip').forEach(function(c) {
          c.style.background = 'white';
          c.style.color = '';
          c.style.borderColor = '#E8ECF1';
        });
        chip.style.background = 'var(--primary)';
        chip.style.color = 'white';
        chip.style.borderColor = 'var(--primary)';
        state.filter = chip.dataset.filter;
        renderList(container);
      });
    });

    var sortSel = document.getElementById('sort-select');
    if (sortSel) {
      sortSel.addEventListener('change', function() {
        state.sortBy = this.value;
        renderList(container);
      });
    }
  }

  function init() {
    var observer = new MutationObserver(function() {
      var screen = document.getElementById('patient-providers');
      if (screen && screen.classList.contains('active')) {
        setTimeout(injectDirectory, 100);
      }
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    console.log('✅ providers-list initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();