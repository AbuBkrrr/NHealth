// ============================================
// N-Health UI Interaction Fixes
// ============================================
function showModal(title, bodyHTML, actionsHTML) {
  const existing = document.getElementById('app-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'app-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = '<div class="modal-content"><button class="close-btn" onclick="closeModal()">X</button><h3 style="font-size:16px;margin-bottom:12px;">' + title + '</h3><div>' + bodyHTML + '</div>' + (actionsHTML ? '<div class="modal-actions">' + actionsHTML + '</div>' : '') + '</div>';
  document.body.appendChild(modal);
}
function closeModal() { const m = document.getElementById('app-modal'); if (m) m.remove(); }

function openNewMessage() {
  showModal('\u{1F4DD} New Message',
    '<div class="form-group"><label>To</label><input type="text" id="msg-to" value="Dr. Adebayo Ogunlesi"></div>' +
    '<div class="form-group"><label>Subject</label><input type="text" id="msg-subject" placeholder="Subject"></div>' +
    '<div class="form-group"><label>Message</label><textarea rows="4" id="msg-body" placeholder="Type your message..." style="padding:8px 12px;font-size:13px;font-family:inherit;resize:vertical;"></textarea></div>',
    '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="sendMessage()">\u{1F4E4} Send</button>');
}
function sendMessage() {
  const b = document.getElementById('msg-body').value.trim();
  if (!b) { showToast('\u26A0 Please type a message'); return; }
  closeModal(); showToast('\u2705 Message sent successfully');
}

function enrollInsurance(planName, price, coverage) {
  showModal('\u{1F6E1} ' + planName,
    '<div style="background:var(--primary-light);padding:12px;border-radius:8px;margin-bottom:12px;">' +
      '<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:600;"><span>Annual Premium</span><span style="color:var(--primary);">\u20A6' + price.toLocaleString() + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-top:4px;"><span>Coverage</span><span>\u20A6' + coverage + '</span></div>' +
    '</div>' +
    '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">What is included:</div>' +
    '<ul class="info-list"><li>Outpatient consultations</li><li>Inpatient hospitalization</li><li>Emergency services</li><li>Prescription drugs</li><li>Diagnostic tests</li></ul>' +
    '<div class="form-group" style="margin-top:12px;"><label>Payment Method</label><select><option>Debit Card</option><option>Bank Transfer</option><option>USSD</option></select></div>',
    '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="confirmEnrollment(\'' + planName + '\')">Pay \u20A6' + price.toLocaleString() + '</button>');
}
function confirmEnrollment(name) { closeModal(); showToast('\u2705 Enrolled in ' + name + '!'); }
function openInsuranceClaims() { navigateTo('patient-claims'); }

function sponsorPatient() {
  showModal('\u{1F464} Sponsor a Patient',
    '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Your contribution will directly fund medical care for a child in need.</p>' +
    '<div class="form-group"><label>Select Patient</label><select><option>Baby Chidi - Heart Surgery (\u20A6150,000 needed)</option><option>Amina Suleiman - Cancer Treatment (\u20A680,000 needed)</option><option>Any patient (general fund)</option></select></div>' +
    '<div class="form-group"><label>Amount (\u20A6)</label><input type="number" id="sponsor-amount" placeholder="e.g. 5000"></div>' +
    '<div class="amount-presets">' +
      '<div class="preset" onclick="pickPreset(this,\'sponsor-amount\',2000)">\u20A62K</div>' +
      '<div class="preset" onclick="pickPreset(this,\'sponsor-amount\',5000)">\u20A65K</div>' +
      '<div class="preset" onclick="pickPreset(this,\'sponsor-amount\',10000)">\u20A610K</div>' +
    '</div>',
    '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-warning" onclick="confirmSponsor()">\u2764 Sponsor</button>');
}
function pickPreset(el, inputId, amount) {
  el.parentElement.querySelectorAll('.preset').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  const i = document.getElementById(inputId); if (i) i.value = amount;
}
function confirmSponsor() { closeModal(); showToast('\u2764 Thank you! Sponsorship is being processed.'); }

function openDonateModal(cause) {
  showModal('\u2764 Donate - ' + cause,
    '<div class="form-group"><label>Amount (\u20A6)</label><input type="number" id="donate-amount" placeholder="Enter amount"></div>' +
    '<div class="amount-presets">' +
      '<div class="preset" onclick="pickPreset(this,\'donate-amount\',1000)">\u20A61K</div>' +
      '<div class="preset" onclick="pickPreset(this,\'donate-amount\',2500)">\u20A62.5K</div>' +
      '<div class="preset" onclick="pickPreset(this,\'donate-amount\',5000)">\u20A65K</div>' +
      '<div class="preset" onclick="pickPreset(this,\'donate-amount\',10000)">\u20A610K</div>' +
      '<div class="preset" onclick="pickPreset(this,\'donate-amount\',25000)">\u20A625K</div>' +
      '<div class="preset" onclick="pickPreset(this,\'donate-amount\',50000)">\u20A650K</div>' +
    '</div>' +
    '<div class="form-group"><label>Payment Method</label><select><option>Debit Card</option><option>Bank Transfer</option><option>Wallet Balance</option></select></div>',
    '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-success" onclick="confirmDonation(\'' + cause + '\')">\u2764 Donate</button>');
}
function confirmDonation(cause) {
  const amt = document.getElementById('donate-amount').value;
  if (!amt || amt <= 0) { showToast('\u26A0 Please enter an amount'); return; }
  closeModal();
  showToast('\u2764 Thank you! \u20A6' + Number(amt).toLocaleString() + ' donated');
}

function registerOrganDonor() {
  showModal('\u2764 Register as Organ Donor',
    '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">By registering, you consent to donate your organs after death to save lives.</p>' +
    '<div class="form-group"><label>Blood Group *</label><select><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></div>' +
    '<div class="form-group"><label>Next of Kin Name *</label><input type="text" placeholder="Full name"></div>' +
    '<div class="form-group"><label>Next of Kin Phone *</label><input type="tel" placeholder="+234 800 000 0000"></div>' +
    '<div class="form-group"><label>Organs to donate</label><select><option>All eligible organs</option><option>Kidney</option><option>Liver</option><option>Heart</option><option>Cornea</option></select></div>' +
    '<div style="display:flex;gap:6px;margin-top:12px;padding:10px;background:#FEF7E0;border-radius:8px;"><span>\u2139</span><span style="font-size:11px;color:var(--text-secondary);">You can change your decision at any time. No cost involved.</span></div>',
    '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="confirmOrganDonor()">Register</button>');
}
function confirmOrganDonor() { closeModal(); showToast('\u2705 Registered as organ donor!'); }

function showOrganInfo() {
  showModal('\u{1F4D6} About Organ Donation',
    '<ul class="info-list" style="font-size:13px;line-height:1.8;">' +
      '<li><strong>One donor can save up to 8 lives.</strong></li>' +
      '<li>Organs: kidney, liver, heart, lungs, pancreas, intestines.</li>' +
      '<li>Tissues: corneas, skin, bone, heart valves.</li>' +
      '<li>Donation does not disfigure the body.</li>' +
      '<li>Most religions encourage it.</li>' +
      '<li>Living donors can donate a kidney or part of the liver.</li>' +
      '<li>No cost to the donor or their family.</li>' +
      '<li>Deceased donation requires family consent in Nigeria.</li>' +
    '</ul>',
    '<button class="btn btn-primary btn-block" onclick="closeModal()">Got it</button>');
}
function showAccreditedCenters() {
  showModal('\u{1F3E5} Accredited Transplant Centers',
    '<div class="list-item" style="border-bottom:1px solid #E8ECF1;"><div class="avatar">\u{1F3E5}</div><div class="content"><div class="title">Lagos University Teaching Hospital</div><div class="subtitle">Idi-Araba, Lagos</div></div></div>' +
    '<div class="list-item" style="border-bottom:1px solid #E8ECF1;"><div class="avatar">\u{1F3E5}</div><div class="content"><div class="title">St. Nicholas Hospital</div><div class="subtitle">Lagos Island, Lagos</div></div></div>' +
    '<div class="list-item"><div class="avatar">\u{1F3E5}</div><div class="content"><div class="title">University College Hospital</div><div class="subtitle">Ibadan, Oyo</div></div></div>',
    '<button class="btn btn-primary btn-block" onclick="closeModal()">Close</button>');
}

function bookBloodDonation(centerName, address) {
  showModal('\u{1FA78} Book Blood Donation',
    '<div style="background:#FFEBEE;padding:12px;border-radius:8px;margin-bottom:12px;">' +
      '<div style="font-weight:600;font-size:14px;">' + centerName + '</div>' +
      '<div style="font-size:12px;color:var(--text-secondary);">' + address + '</div>' +
    '</div>' +
    '<div class="form-group"><label>Preferred Date</label><input type="date"></div>' +
    '<div class="form-group"><label>Preferred Time</label><select><option>09:00 AM</option><option>10:00 AM</option><option>11:00 AM</option><option>02:00 PM</option><option>03:00 PM</option><option>04:00 PM</option></select></div>' +
    '<div style="display:flex;gap:6px;margin-top:12px;padding:10px;background:#E6F4EA;border-radius:8px;"><span>\u2705</span><span style="font-size:11px;">Your blood type (A+) is urgently needed.</span></div>',
    '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-danger" onclick="closeModal();showToast(\'\u2705 Blood donation appointment booked!\')">Confirm</button>');
}

function showProviderProfile(name, specialty, fee, rating) {
  showModal(name,
    '<div style="text-align:center;padding:12px 0;"><div style="font-size:48px;">\u{1F468}\u200D\u2695</div>' +
      '<div style="font-weight:600;font-size:15px;margin-top:6px;">' + name + '</div>' +
      '<div style="font-size:12px;color:var(--text-secondary);">' + specialty + '</div>' +
      '<div style="font-size:14px;margin-top:6px;">\u2B50 ' + rating + ' <span style="font-size:11px;color:var(--text-secondary);">(24 reviews)</span></div></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;padding:12px;background:var(--surface);border-radius:8px;">' +
      '<div><div style="color:var(--text-light);font-size:10px;">Qualification</div><div>MBBS, MD</div></div>' +
      '<div><div style="color:var(--text-light);font-size:10px;">Experience</div><div>12 years</div></div>' +
      '<div><div style="color:var(--text-light);font-size:10px;">Hospital</div><div>LUTH</div></div>' +
      '<div><div style="color:var(--text-light);font-size:10px;">Location</div><div>Lagos</div></div>' +
      '<div><div style="color:var(--text-light);font-size:10px;">Consultation</div><div>\u20A6' + fee.toLocaleString() + '</div></div>' +
    '</div>' +
    '<p style="font-size:12px;color:var(--text-secondary);line-height:1.6;margin-top:12px;">Specialist with 12+ years of experience. Committed to compassionate, evidence-based care.</p>',
    '<button class="btn btn-outline" onclick="closeModal()">Close</button>' +
    '<button class="btn btn-primary" onclick="closeModal();navigateTo(\'patient-appointments\')">\u{1F4C5} Book</button>');
}

function acceptAppointment() {
  showToast('\u2705 Appointment confirmed!');
  setTimeout(() => navigateTo('patient-home'), 800);
}
function cancelAppointment() {
  showModal('\u274C Cancel Appointment',
    '<p style="font-size:13px;margin-bottom:12px;">Please tell us why you are cancelling.</p>' +
    '<div class="form-group"><label>Reason</label><select><option>Schedule conflict</option><option>Feeling better</option><option>Found another doctor</option><option>Financial reasons</option><option>Other</option></select></div>' +
    '<div class="form-group"><label>Additional comments</label><textarea rows="2" style="padding:8px 12px;font-size:13px;font-family:inherit;"></textarea></div>',
    '<button class="btn btn-outline" onclick="closeModal()">Keep</button>' +
    '<button class="btn btn-danger" onclick="closeModal();showToast(\'Appointment cancelled\');setTimeout(()=>navigateTo(\'patient-home\'),800)">Confirm</button>');
}

function openPaymentGateway(amount, description) {
  showModal('\u{1F4B3} Payment',
    '<div class="payment-summary">' +
      '<div class="row"><span>' + description + '</span><span>\u20A6' + Number(amount).toLocaleString() + '</span></div>' +
      '<div class="row"><span>Service Fee (5%)</span><span>\u20A6' + Math.round(amount * 0.05).toLocaleString() + '</span></div>' +
      '<div class="row total"><span>Total</span><span style="color:var(--primary);">\u20A6' + Math.round(amount * 1.05).toLocaleString() + '</span></div>' +
    '</div>' +
    '<div class="form-group"><label>Payment Method</label><select><option>Debit Card</option><option>Bank Transfer</option><option>Wallet Balance</option></select></div>' +
    '<div style="font-size:11px;color:var(--text-secondary);margin-top:8px;">\u{1F512} Secured by Paystack</div>',
    '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="closeModal();showToast(\'\u2705 Payment successful!\');setTimeout(()=>navigateTo(\'patient-home\'),1200)">Pay Now</button>');
}

var pharmacyCart = [];
function addToCart(name, price) {
  pharmacyCart.push({ name: name, price: price });
  updateCartBadge();
  showToast('\u{1F6D2} ' + name + ' added to cart');
}
function updateCartBadge() {
  var badge = document.getElementById('cart-badge');
  if (badge) {
    badge.textContent = pharmacyCart.length;
    badge.style.display = pharmacyCart.length > 0 ? 'inline-block' : 'none';
  }
}
function openCart() {
  if (pharmacyCart.length === 0) {
    showModal('\u{1F6D2} Your Cart',
      '<div style="text-align:center;padding:32px 0;"><div style="font-size:48px;">\u{1F6D2}</div><p style="font-size:13px;color:var(--text-secondary);margin-top:8px;">Your cart is empty</p></div>',
      '<button class="btn btn-primary btn-block" onclick="closeModal()">Browse Products</button>');
    return;
  }
  var subtotal = pharmacyCart.reduce(function(s, i) { return s + i.price; }, 0);
  var itemsHTML = pharmacyCart.map(function(item, i) {
    return '<div class="cart-item-row"><div><div style="font-weight:500;">' + item.name + '</div><div style="font-size:11px;color:var(--text-secondary);">\u20A6' + item.price.toLocaleString() + '</div></div><button class="btn btn-danger btn-sm" onclick="removeFromCart(' + i + ')">X</button></div>';
  }).join('');
  showModal('\u{1F6D2} Your Cart (' + pharmacyCart.length + ' items)',
    itemsHTML +
    '<div class="payment-summary" style="margin-top:12px;">' +
      '<div class="row"><span>Subtotal</span><span>\u20A6' + subtotal.toLocaleString() + '</span></div>' +
      '<div class="row"><span>Service Fee (5%)</span><span>\u20A6' + Math.round(subtotal * 0.05).toLocaleString() + '</span></div>' +
      '<div class="row total"><span>Total</span><span style="color:var(--primary);">\u20A6' + Math.round(subtotal * 1.05).toLocaleString() + '</span></div>' +
    '</div>',
    '<button class="btn btn-outline" onclick="closeModal()">Continue</button>' +
    '<button class="btn btn-pharmacy" onclick="checkoutCart()">Checkout</button>');
}
function removeFromCart(i) {
  pharmacyCart.splice(i, 1);
  closeModal();
  openCart();
  updateCartBadge();
}
function checkoutCart() {
  var total = Math.round(pharmacyCart.reduce(function(s, i) { return s + i.price; }, 0) * 1.05);
  pharmacyCart = [];
  updateCartBadge();
  closeModal();
  openPaymentGateway(total, 'Pharmacy Order');
}
function showProductDetail(name, generic, price, stock) {
  showModal('\u{1F48A} ' + name,
    '<div style="background:var(--pharmacy-light);padding:12px;border-radius:8px;margin-bottom:12px;">' +
      '<div style="font-size:13px;color:var(--text-secondary);">' + generic + '</div>' +
      '<div style="font-size:24px;font-weight:700;color:var(--pharmacy-color);margin-top:4px;">\u20A6' + price.toLocaleString() + '</div>' +
      '<div style="font-size:11px;margin-top:4px;">' + (stock > 0 ? '<span class="badge badge-instock">In Stock</span> (' + stock + ' units)' : '<span class="badge badge-error">Out of Stock</span>') + '</div>' +
    '</div>' +
    '<ul class="info-list">' +
      '<li><strong>Brand:</strong> Coartem</li><li><strong>Manufacturer:</strong> Novartis</li>' +
      '<li><strong>Category:</strong> Antimalarial</li><li><strong>Form:</strong> Tablet</li>' +
      '<li><strong>Strength:</strong> 20/120mg</li><li><strong>Batch:</strong> B2024-001</li>' +
      '<li><strong>Expiry:</strong> Dec 2025</li><li><strong>Storage:</strong> Room Temperature</li>' +
    '</ul>' +
    '<div style="background:#FEF7E0;padding:10px;border-radius:8px;margin-top:12px;font-size:11px;">\u26A0 Consult your doctor before use.</div>',
    '<button class="btn btn-outline" onclick="closeModal()">Close</button>' +
    '<button class="btn btn-pharmacy" onclick="closeModal();addToCart(\'' + name + '\',' + price + ')">Add to Cart</button>');
}

function bookLabTest(testName, price) {
  showModal('\u{1F52C} Book Lab Test',
    '<div style="background:var(--lab-light);padding:12px;border-radius:8px;margin-bottom:12px;">' +
      '<div style="font-weight:600;font-size:14px;">' + testName + '</div>' +
      '<div style="font-size:18px;font-weight:700;color:var(--lab-color);margin-top:4px;">\u20A6' + price.toLocaleString() + '</div>' +
    '</div>' +
    '<div class="form-group"><label>Preferred Lab</label><select><option>Lagos Medical Lab - Surulere</option><option>LUTH Diagnostic Center</option><option>Reddington Diagnostics</option></select></div>' +
    '<div class="form-group"><label>Preferred Date</label><input type="date"></div>' +
    '<div class="form-group"><label>Preferred Time</label><select><option>09:00 AM</option><option>11:00 AM</option><option>02:00 PM</option><option>04:00 PM</option></select></div>',
    '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-lab" onclick="closeModal();openPaymentGateway(' + price + ',\'Lab Test\')">Continue</button>');
}

function openAppointmentReport(doctor, date, type) {
  showModal('\u{1F4C4} Medical Report',
    '<div style="background:var(--surface);padding:12px;border-radius:8px;margin-bottom:12px;">' +
      '<div style="font-weight:600;">' + doctor + '</div>' +
      '<div style="font-size:12px;color:var(--text-secondary);">' + type + ' - ' + date + '</div>' +
    '</div>' +
    '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">Diagnosis</div>' +
    '<p style="font-size:12px;color:var(--text-secondary);line-height:1.6;margin-bottom:12px;">Mild hypertension - Stage 1. BP: 140/90 mmHg.</p>' +
    '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">Prescription</div>' +
    '<ul class="info-list"><li>Amlodipine 5mg - 1 tablet daily</li><li>Low sodium diet, exercise 30 min/day</li></ul>',
    '<button class="btn btn-primary btn-block" onclick="showToast(\'Report downloaded\');closeModal();">\u{1F4E5} Download PDF</button>');
}