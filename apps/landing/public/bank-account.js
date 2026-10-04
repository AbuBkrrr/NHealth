// ============================================
// Provider Bank Account Setup (for escrow payouts)
// ============================================
(function() {
  'use strict';

  var API = 'https://n-health-backend-production.up.railway.app';
  function getToken() { return localStorage.getItem('token'); }

  var cachedBanks = null;

  async function fetchBanks() {
    if (cachedBanks) return cachedBanks;
    try {
      var res = await fetch(API + '/api/escrow/banks', {
        headers: { 'Authorization': 'Bearer ' + getToken() },
      });
      var data = await res.json();
      cachedBanks = data.banks || [];
      return cachedBanks;
    } catch (e) {
      return [];
    }
  }

  async function fetchMyBank() {
    try {
      var res = await fetch(API + '/api/provider/bank', {
        headers: { 'Authorization': 'Bearer ' + getToken() },
      });
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // ============================================================
  // OPEN BANK SETUP MODAL
  // ============================================================
  window.openBankSetup = async function() {
    if (typeof closeModal === 'function') closeModal();

    showModal('🏦 Bank Account',
      '<div style="text-align:center;padding:30px 0;"><div style="font-size:36px;">🏦</div><p style="font-size:13px;color:var(--text-secondary);margin-top:8px;">Loading banks...</p></div>',
      '');

    var banks = await fetchBanks();
    var current = await fetchMyBank();

    if (!banks || banks.length === 0) {
      closeModal();
      showToast('Could not load bank list');
      return;
    }

    var bankOptions = '<option value="">-- Select your bank --</option>' +
      banks.map(function(b) {
        var selected = current && current.bankCode === b.code ? ' selected' : '';
        return '<option value="' + b.code + '" data-name="' + b.name + '"' + selected + '>' + b.name + '</option>';
      }).join('');

    var html =
      '<div style="background:#E8F0FE;padding:12px;border-radius:8px;margin-bottom:14px;font-size:12px;line-height:1.6;">' +
        'Your bank account receives payouts from escrow when you complete services. Add it here to enable bookings.' +
      '</div>' +

      (current ?
        '<div style="background:#E6F4EA;padding:12px;border-radius:8px;margin-bottom:14px;font-size:12px;">' +
          '<div style="font-weight:600;">✓ Current Account</div>' +
          '<div>' + current.bankName + ' • ' + current.accountNumber + '</div>' +
          '<div style="color:var(--text-secondary);">' + current.accountName + '</div>' +
        '</div>' : '') +

      '<div class="form-group">' +
        '<label>Bank *</label>' +
        '<select id="bank-code">' + bankOptions + '</select>' +
      '</div>' +

      '<div class="form-group">' +
        '<label>Account Number (10 digits) *</label>' +
        '<input type="tel" id="bank-account" maxlength="10" placeholder="0123456789" oninput="this.value=this.value.replace(/[^0-9]/g,\'\')"' + (current ? ' value="' + current.accountNumber + '"' : '') + '>' +
      '</div>' +

      '<div class="form-group">' +
        '<label>Account Name *</label>' +
        '<input type="text" id="bank-name" placeholder="As it appears on your bank statement"' + (current ? ' value="' + current.accountName + '"' : '') + '>' +
      '</div>' +

      '<div style="background:#FEF7E0;padding:10px;border-radius:8px;font-size:11px;">' +
        '⚠️ Double-check the account details. Payouts go directly to this account.' +
      '</div>';

    showModal('🏦 Bank Account',
      html,
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="window.saveBankAccount()">' + (current ? 'Update' : 'Save') + ' Account</button>');
  };

  window.saveBankAccount = async function() {
    var code = (document.getElementById('bank-code') || {}).value;
    var account = (document.getElementById('bank-account') || {}).value;
    var name = (document.getElementById('bank-name') || {}).value;

    if (!code) { showToast('Select your bank'); return; }
    if (!/^\d{10}$/.test(account)) { showToast('Account number must be 10 digits'); return; }
    if (!name || name.length < 2) { showToast('Enter account name'); return; }

    var bankName = (document.querySelector('#bank-code option:checked') || {}).dataset?.name || 'Bank';

    try {
      var res = await fetch(API + '/api/provider/bank', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken(),
        },
        body: JSON.stringify({
          bankCode: code,
          bankName: bankName,
          accountNumber: account,
          accountName: name,
        }),
      });
      var data = await res.json();

      if (res.ok) {
        closeModal();
        showToast('✅ Bank account saved');
        console.log('Bank account saved:', data);
      } else {
        showToast('❌ ' + (data.error || data.message || 'Failed to save'));
      }
    } catch (e) {
      showToast('Network error');
    }
  };

  // ============================================================
  // INJECT BUTTON INTO PROVIDER PROFILES
  // ============================================================
  function injectButton() {
    var providerScreens = ['doctor-profile', 'pharmacy-profile', 'institution-profile', 'patient-profile'];
    providerScreens.forEach(function(id) {
      var screen = document.getElementById(id);
      if (!screen || screen.dataset.bankBtnInjected) return;

      // Only for provider roles — check user role
      var user = {};
      try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch (e) {}
      if (id === 'patient-profile' && user.role === 'PATIENT') return;

      var card = screen.querySelector('.card:last-child');
      if (!card) return;

      var btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-block';
      btn.style.marginTop = '12px';
      btn.textContent = '🏦 Bank Account for Payouts';
      btn.onclick = window.openBankSetup;
      card.appendChild(btn);
      screen.dataset.bankBtnInjected = 'true';
    });
  }

  function init() {
    setTimeout(injectButton, 800);
    var observer = new MutationObserver(function() { injectButton(); });
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('✅ bank-account initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();