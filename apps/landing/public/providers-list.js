// ============================================
// Providers Directory — cards with online status + filters
// ============================================
(function() {
  'use strict';

  var PROVIDERS = [
    { id: 'd1', type: 'DOCTOR', icon: '👨‍⚕️', name: 'Dr. Adebayo Ogunlesi', specialty: 'Cardiology', rating: 4.8, reviews: 24, location: 'Lagos', experience: 12, fee: 15000, online: true },
    { id: 'd2', type: 'DOCTOR', icon: '👩‍⚕️', name: 'Dr. Funmi Adeyemi', specialty: 'Pediatrics', rating: 4.6, reviews: 18, location: 'Lagos', experience: 8, fee: 10000, online: false },
    { id: 'd3', type: 'DOCTOR', icon: '👨‍⚕️', name: 'Dr. Chidi Okonkwo', specialty: 'Orthopedics', rating: 4.9, reviews: 32, location: 'Abuja', experience: 15, fee: 20000, online: true },
    { id: 'd4', type: 'DOCTOR', icon: '👩‍⚕️', name: 'Dr. Aisha Bello', specialty: 'Dermatology', rating: 4.7, reviews: 20, location: 'Lagos', experience: 10, fee: 12000, online: true },
    { id: 'p1', type: 'PHARMACY', icon: '💊', name: 'HealthPlus Pharmacy', specialty: 'Retail Pharmacy', rating: 4.5, reviews: 18, location: 'Surulere, Lagos', experience: 10, fee: 0, online: true },
    { id: 'p2', type: 'PHARMACY', icon: '💊', name: 'MedPlus Pharmacy', specialty: 'Retail Pharmacy', rating: 4.3, reviews: 12, location: 'Ikeja, Lagos', experience: 6, fee: 0, online: false },
    { id: 'l1', type: 'LAB', icon: '🔬', name: 'Lagos Medical Lab', specialty: 'Diagnostics', rating: 4.7, reviews: 30, location: 'Surulere, Lagos', experience: 12, fee: 0, online: true },
    { id: 'l2', type: 'LAB', icon: '🔬', name: 'LUTH Diagnostics', specialty: 'Radiology', rating: 4.4, reviews: 22, location: 'Idi-Araba, Lagos', experience: 20, fee: 0, online: true },
    { id: 'n1', type: 'NURSE', icon: '👩‍⚕️', name: 'Nurse Funmi Adeyemi', specialty: 'Pediatric Nurse', rating: 4.8, reviews: 15, location: 'Lagos', experience: 8, fee: 8000, online: true },
    { id: 'a1', type: 'AMBULANCE', icon: '🚑', name: 'N-Health Ambulance', specialty: 'Emergency Transport', rating: 4.6, reviews: 40, location: 'Lagos', experience: 5, fee: 0, online: true },
  ];

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
      '<button class="btn btn-primary" onclick="closeModal();showToast(\'Opening booking...\');">📅 Book Now</button>');
  }

  function injectDirectory() {
    var screen = document.getElementById('patient-providers');
    if (!screen || screen.dataset.dirInjected) return;
    screen.dataset.dirInjected = 'true';

    var padding = screen.querySelector('div[style*="padding"]');
    if (!padding) return;

    // Build filters bar + list container
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

    // Wire filters
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