
// ========== Extracted inline block 1 ==========
// ================================================
        // CONFIGURATION - BACKEND API URL
        // ================================================
        // Change this URL if your backend endpoint is different.
        const API_BASE_URL = 'https://n-health-backend-production.up.railway.app';
        const AUTH_LOGIN_ENDPOINT = API_BASE_URL + '/api/auth/login';
        const AUTH_REGISTER_ENDPOINT = API_BASE_URL + '/api/auth/register';
        const AUTH_ME_ENDPOINT = API_BASE_URL + '/api/auth/me'; // Optional: for fetching real profile

        // ================================================
        // STATE
        // ================================================
        let currentScreen = 'splash';
        let userRole = 'patient';
        let providerType = 'doctor';
        let selectedProviderName = '';
        let selectedDate = '';
        let selectedTime = '';
        let isOnline = true;
        let currentUser = null;

        // ================================================
        // NETWORK DETECTION
        // ================================================
        function checkNetwork() {
            const status = navigator.onLine;
            if (status !== isOnline) {
                isOnline = status;
                if (!isOnline) {
                    showToast('📶 You are offline. Changes will sync when connected.');
                }
            }
        }

        window.addEventListener('online', checkNetwork);
        window.addEventListener('offline', checkNetwork);

        // ================================================
        // NAVIGATION
        // ================================================
        function navigateTo(screen) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const target = document.getElementById(screen);
            if (target) { target.classList.add('active'); target.scrollTop = 0; }
            currentScreen = screen;

            document.querySelectorAll('.bottom-nav').forEach(n => n.style.display = 'none');
            const patientNav = document.getElementById('patient-nav');
            const doctorNav = document.getElementById('doctor-nav');
            const pharmacyNav = document.getElementById('pharmacy-nav');
            const institutionNav = document.getElementById('institution-nav');

            if (screen === 'splash' || screen === 'auth') {
                // All navs hidden
            } else if (screen.startsWith('patient-') || screen === 'patient-home') {
                patientNav.style.display = 'flex';
                patientNav.querySelectorAll('button').forEach(b => {
                    b.classList.remove('active');
                    if (b.dataset.screen === screen) b.classList.add('active');
                });
            } else if (screen.startsWith('doctor-') || screen === 'doctor-home') {
                doctorNav.style.display = 'flex';
                doctorNav.querySelectorAll('button').forEach(b => {
                    b.classList.remove('active');
                    if (b.dataset.screen === screen) b.classList.add('active');
                });
            } else if (screen.startsWith('pharmacy-') || screen === 'pharmacy-home') {
                pharmacyNav.style.display = 'flex';
                pharmacyNav.querySelectorAll('button').forEach(b => {
                    b.classList.remove('active');
                    if (b.dataset.screen === screen) b.classList.add('active');
                });
            } else if (screen.startsWith('institution-') || screen === 'institution-home') {
                institutionNav.style.display = 'flex';
                institutionNav.querySelectorAll('button').forEach(b => {
                    b.classList.remove('active');
                    if (b.dataset.screen === screen) b.classList.add('active');
                });
            }

            checkNetwork();
        }

        // ================================================
        // AUTH
        // ================================================
        function selectRole(role) {
            userRole = role;
            document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
            document.getElementById('role-' + role).classList.add('selected');

            const providerTypes = ['doctor', 'pharmacy', 'lab', 'ambulance', 'nurse'];
            document.getElementById('provider-type-section').style.display = providerTypes.includes(role) ? 'block' : 'none';
            document.getElementById('institution-register-form').style.display = role === 'institution' ? 'block' : 'none';

            const btn = document.getElementById('login-btn');
            if (role === 'patient') {
                btn.textContent = 'Sign In as Patient';
                btn.className = 'btn btn-primary btn-block';
            } else if (role === 'institution') {
                btn.textContent = 'Sign In as Institution';
                btn.className = 'btn btn-institution btn-block';
            } else {
                btn.textContent = 'Sign In as ' + role.charAt(0).toUpperCase() + role.slice(1);
                btn.className = 'btn btn-primary btn-block';
            }
        }

        function selectProviderType(type) {
            providerType = type;
            document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
            document.getElementById('ptype-' + type).classList.add('selected');
        }

        // ---- REAL LOGIN: calls backend API ----
        async function login() {
            const emailInput = document.getElementById('login-email');
            const passwordInput = document.getElementById('login-password');
            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                showToast('⚠️ Please enter your email and password');
                return;
            }

            const btn = document.getElementById('login-btn');
            const originalText = btn.textContent;
            btn.textContent = 'Signing in...';
            btn.disabled = true;

            try {
                const response = await fetch(AUTH_LOGIN_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, role: (window.selectedProviderRole || 'PATIENT').toUpperCase() })
                });

                let data = {};
                try { data = await response.json(); } catch (e) { /* ignore non-JSON */ }

                // ================================================
                // 🔍 DEBUG LOG START - COPY/PASTE THIS TO FIND IT
                // ================================================
                console.log('🔍 BACKEND LOGIN RESPONSE:', data);
                // ================================================
                // 🔍 DEBUG LOG END
                // ================================================

                if (response.ok) {
                    // Save token + user
                    if (data.token) localStorage.setItem('token', data.token);
                    if (data.user) {
                        localStorage.setItem('user', JSON.stringify(data.user));
                        currentUser = data.user;
                    } else {
                        currentUser = { email };
                        localStorage.setItem('user', JSON.stringify(currentUser));
                    }

                    // Try fetching full profile from backend (optional)
                    if (data.token) {
                        try {
                            const profileRes = await fetch(AUTH_ME_ENDPOINT, {
                                headers: { 'Authorization': 'Bearer ' + data.token }
                            });
                            if (profileRes.ok) {
                                const profileData = await profileRes.json();
                                const realUser = profileData.user || profileData;
                                localStorage.setItem('user', JSON.stringify(realUser));
                                currentUser = realUser;
                                console.log('✅ Fetched real user profile:', realUser);
                            }
                        } catch (e) {
                            console.log('ℹ️ Could not fetch /me endpoint, using login data');
                        }
                    }

                    // Update profile display
                    applyUserToUI(currentUser);

                    // Route to the correct dashboard based on role
                    const role = (currentUser && currentUser.role) ? currentUser.role : userRole;
                    if (role === 'patient') {
                        navigateTo('patient-home');
                    } else if (role === 'doctor') {
                        navigateTo('doctor-home');
                    } else if (role === 'pharmacy') {
                        navigateTo('pharmacy-home');
                    } else if (role === 'institution') {
                        navigateTo('institution-home');
                    } else {
                        navigateTo('patient-home');
                    }
                    showToast('Welcome back! 👋');
                } else {
                    showToast('❌ ' + (data.message || data.error || 'Login failed. Check your credentials.'));
                }
            } catch (err) {
                console.error('Login error:', err);
                showToast('❌ Network error. Please try again.');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        // ---- REAL REGISTER: calls backend API ----
        async function registerUser() {
            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const phone = document.getElementById('reg-phone').value.trim();
            const password = document.getElementById('reg-password').value;

            if (!name || !email || !password) {
                showToast('⚠️ Please fill in all required fields');
                return;
            }
            if (password.length < 6) {
                showToast('⚠️ Password must be at least 6 characters');
                return;
            }

            try {
                const response = await fetch(AUTH_REGISTER_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, phone, password, role: (window.selectedProviderRole || 'PATIENT').toUpperCase(), profile: window.selectedSpecialty ? { specialty: window.selectedSpecialty } : undefined })
                });

                let data = {};
                try { data = await response.json(); } catch (e) { /* ignore */ }

                if (response.ok) {
                    showToast('✅ Account created! Please sign in.');
                    document.getElementById('registerForm').style.display = 'none';
                    document.getElementById('login-email').value = email;
                    document.getElementById('login-password').value = '';
                } else {
                    showToast('❌ ' + (data.message || data.error || 'Registration failed.'));
                }
            } catch (err) {
                console.error('Registration error:', err);
                showToast('❌ Network error. Please try again.');
            }
        }

        // ---- REAL INSTITUTION REGISTER: calls backend API ----
        async function registerInstitution() {
            const name = document.getElementById('inst-name').value.trim();
            const type = document.getElementById('inst-type').value;
            const license = document.getElementById('inst-license').value.trim();
            const email = document.getElementById('inst-email').value.trim();
            const phone = document.getElementById('inst-phone').value.trim();
            const address = document.getElementById('inst-address').value.trim();
            const state = document.getElementById('inst-state').value;
            const password = document.getElementById('inst-password').value;
            const password2 = document.getElementById('inst-password2').value;

            if (!name || !email || !license || !password) {
                showToast('⚠️ Please fill in all required fields');
                return;
            }
            if (password !== password2) {
                showToast('⚠️ Passwords do not match');
                return;
            }
            if (password.length < 6) {
                showToast('⚠️ Password must be at least 6 characters');
                return;
            }

            try {
                const response = await fetch(AUTH_REGISTER_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name, email, phone, address,
                        licenseNumber: license,
                        institutionType: type,
                        state,
                        password,
                        role: 'institution'
                    })
                });

                let data = {};
                try { data = await response.json(); } catch (e) { /* ignore */ }

                if (response.ok) {
                    showToast('✅ Institution registered! Verification in progress.');
                    document.getElementById('institution-register-form').style.display = 'none';
                    document.getElementById('login-email').value = email;
                    setTimeout(() => {
                        navigateTo('auth');
                    }, 1500);
                } else {
                    showToast('❌ ' + (data.message || data.error || 'Registration failed.'));
                }
            } catch (err) {
                console.error('Institution registration error:', err);
                showToast('❌ Network error. Please try again.');
            }
        }

        function applyUserToUI(user) {
            if (!user) return;
            const name = user.name || (user.email ? user.email.split('@')[0] : 'User');
            const email = user.email || '';
            const welcomeEl = document.getElementById('patient-welcome-name');
            const profileNameEl = document.getElementById('profile-name');
            const profileEmailEl = document.getElementById('profile-email');
            if (welcomeEl) welcomeEl.textContent = name.split(' ')[0];
            if (profileNameEl) profileNameEl.textContent = name;
            if (profileEmailEl) profileEmailEl.textContent = email;
        }

        function logout() {
            if (confirm('Logout?')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                currentUser = null;
                navigateTo('auth');
                showToast('Logged out');
            }
        }

        function showRegister() {
            document.getElementById('registerForm').style.display = 'block';
        }

        // ================================================
        // PROFILE PHOTO UPLOAD
        // ================================================
        function triggerAvatarUpload() {
            const input = document.getElementById('avatar-input');
            if (input) input.click();
        }

        function handleAvatarUpload(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.getElementById('profile-avatar-img');
                    const placeholder = document.getElementById('profile-avatar-placeholder');
                    if (img) {
                        img.src = e.target.result;
                        img.style.display = 'block';
                    }
                    if (placeholder) placeholder.style.display = 'none';
                    // Save to localStorage for persistence
                    localStorage.setItem('avatar', e.target.result);
                };
                reader.readAsDataURL(file);
            }
        }

        // ================================================
        // TAB SWITCHING
        // ================================================
        function switchTab(element, tabId) {
            const parent = element.parentElement;
            parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            element.classList.add('active');
            const container = element.closest('.screen');
            container.querySelectorAll('[id$="-upcoming"], [id$="-book"], [id$="-history"], [id$="-booking"], [id$="-results-tab"], [id$="-history-tab"], [id$="-blood"], [id$="-organ"], [id$="-fund"], [id$="-patient"], [id$="-pending"], [id$="-accepted"], [id$="-completed"], [id$="-processing"]')
                .forEach(t => t.style.display = 'none');
            const target = document.getElementById(tabId);
            if (target) target.style.display = 'block';
        }

        // ================================================
        // EMERGENCY
        // ================================================
        function requestEmergency() {
            if (!isOnline) {
                showToast('📶 You are offline. Emergency saved. Will send when online.');
                const statusDiv = document.getElementById('emergencyStatus');
                if (statusDiv) {
                    statusDiv.style.display = 'block';
                    statusDiv.scrollIntoView({ behavior: 'smooth' });
                    statusDiv.innerHTML = `
                            <div class="card" style="border:2px solid var(--warning);">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <div style="font-size:28px;">⏳</div>
                                    <div>
                                        <div style="font-weight:600; font-size:14px;">Emergency Saved Offline!</div>
                                        <div style="font-size:12px; color:var(--text-secondary);">📶 Will be sent when you reconnect</div>
                                        <div style="font-size:11px; color:var(--text-secondary);">🕐 ${new Date().toLocaleTimeString()}</div>
                                    </div>
                                </div>
                                <button class="btn btn-outline btn-block" onclick="cancelEmergency()" style="margin-top:8px; border-color:var(--error); color:var(--error); font-size:12px; padding:8px;">Cancel</button>
                            </div>
                        `;
                }
                return;
            }

            const statusDiv = document.getElementById('emergencyStatus');
            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.scrollIntoView({ behavior: 'smooth' });
                statusDiv.innerHTML = `
                        <div class="card" style="border:2px solid var(--success);">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="font-size:28px;">✅</div>
                                <div>
                                    <div style="font-weight:600; font-size:14px;">Emergency Requested!</div>
                                    <div style="font-size:12px; color:var(--text-secondary);">🚑 Ambulance: AMB-2024-001</div>
                                    <div style="font-size:12px; color:var(--text-secondary);">👨‍⚕️ Doctor: Dr. Adebayo</div>
                                    <div style="font-size:12px; color:var(--text-secondary);">⏱️ ETA: 8 minutes</div>
                                </div>
                            </div>
                            <button class="btn btn-outline btn-block" onclick="cancelEmergency()" style="margin-top:8px; border-color:var(--error); color:var(--error); font-size:12px; padding:8px;">Cancel Emergency</button>
                        </div>
                    `;
            }
            showToast('🚨 Emergency request sent! Help is on the way.');
        }

        function cancelEmergency() {
            if (confirm('Cancel emergency?')) {
                document.getElementById('emergencyStatus').style.display = 'none';
                showToast('Emergency cancelled');
            }
        }

        function callEmergency(num) { alert('Calling ' + num + '...'); }

        // ================================================
        // APPOINTMENTS
        // ================================================
        function showBookAppointment() {
            document.getElementById('p-book').style.display = 'block';
            document.querySelector('#p-book .tab')?.click();
        }

        function showCalendar(providerName, specialty) {
            selectedProviderName = providerName;
            document.getElementById('selected-provider').textContent = providerName + ' - ' + specialty;
            document.getElementById('calendar-view').style.display = 'block';
            document.getElementById('calendar-view').scrollIntoView({ behavior: 'smooth' });
            generateCalendar();

            document.getElementById('appointment-provider').textContent = providerName;
            document.getElementById('appointment-specialty').textContent = specialty;
            document.getElementById('appointment-fee').textContent = '₦15,000';
            document.getElementById('appointment-service-fee').textContent = '₦750';
            document.getElementById('appointment-total').textContent = '₦15,750';

            showToast('📅 Calendar opened for ' + providerName);
        }

        function generateCalendar() {
            const grid = document.getElementById('calendar-grid');
            const headers = grid.querySelectorAll('.day-header');
            grid.innerHTML = '';
            headers.forEach(h => grid.appendChild(h));

            const today = new Date();
            const month = today.getMonth(),
                year = today.getFullYear();
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            for (let i = 0; i < firstDay; i++) {
                const e = document.createElement('div');
                e.className = 'day disabled';
                grid.appendChild(e);
            }
            for (let i = 1; i <= daysInMonth; i++) {
                const day = document.createElement('div');
                day.className = 'day has-slots';
                day.textContent = i;
                const date = new Date(year, month, i);
                if (date < today) day.className = 'day disabled';
                else if (i === today.getDate() && date.getMonth() === today.getMonth()) {
                    day.className = 'day selected';
                    selectedDate = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
                    document.getElementById('appointment-date').textContent = selectedDate;
                }
                day.onclick = function() {
                    grid.querySelectorAll('.day').forEach(d => d.classList.remove('selected'));
                    this.classList.add('selected');
                    selectedDate = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
                    document.getElementById('appointment-date').textContent = selectedDate;
                };
                grid.appendChild(day);
            }
        }

        function selectTimeSlot(time, evt) {
            document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
            if (evt && evt.target) evt.target.classList.add('selected');
            selectedTime = time;
            document.getElementById('appointment-time').textContent = time;
        }

        function closeCalendar() { document.getElementById('calendar-view').style.display = 'none'; }

        function bookAppointment() {
            if (!selectedProviderName || !selectedDate || !selectedTime) {
                showToast('⚠️ Complete all selections');
                return;
            }
            if (!isOnline) {
                showToast('📶 You are offline. Appointment will be booked when online.');
                closeCalendar();
                return;
            }
            showToast('✅ Appointment booked with ' + selectedProviderName + ' on ' + selectedDate + ' at ' + selectedTime);
            closeCalendar();
        }

        // ================================================
        // PHARMACY
        // ================================================
        function searchDrugs(query) {
            const cards = document.querySelectorAll('.product-detail-card');
            if (query.length < 2) { cards.forEach(c => c.style.display = 'block'); return; }
            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                card.style.display = text.includes(query.toLowerCase()) ? 'block' : 'none';
            });
        }

        function filterPOSProducts(query) {
            const container = document.getElementById('pos-products');
            const items = container.querySelectorAll('.list-item');
            if (query.length < 2) { items.forEach(i => i.style.display = 'flex'); return; }
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(query.toLowerCase()) ? 'flex' : 'none';
            });
        }

        // ================================================
        // DONATIONS
        // ================================================
        function checkBloodEligibility() {
            const resultDiv = document.getElementById('blood-eligibility-result');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                    <div class="eligibility-result success">
                        <div class="icon">✅</div>
                        <div class="title">You are eligible to donate blood!</div>
                        <div class="details">Your blood type A+ (Genotype AA) is in high demand.</div>
                    </div>
                    <div class="card" style="margin-top:6px;">
                        <div class="card-title" style="font-size:13px; margin-bottom:4px;">📍 Nearest Donation Centers</div>
                        <div class="donation-location"><div class="name">🏥 National Blood Service Center</div><div class="address">Lagos Island, Lagos</div><div class="distance">📍 2.3 km</div></div>
                        <div class="donation-location"><div class="name">🏥 Red Cross Blood Bank</div><div class="address">Surulere, Lagos</div><div class="distance">📍 4.1 km</div></div>
                    </div>
                `;
            showToast('✅ Blood type A+ - 2 centers nearby');
        }

        // ================================================
        // INSURANCE
        // ================================================
        function viewInsuranceClaims() {
            alert('📄 Insurance Claims\n\n1. LUTH - Cardiology Visit\n   Claimed: ₦35,000\n   Status: Approved ✅\n\n2. Reddington - Lab Tests\n   Claimed: ₦12,500\n   Status: Pending ⏳');
        }

        // ================================================
        // PROVIDER REQUEST HANDLERS
        // ================================================
        function handleDoctorRequest(action) {
            const msgs = { 'accept': '✅ Request accepted', 'refer': '↗ Referred', 'decline': '✕ Declined' };
            showToast(msgs[action]);
            const req = event.target.closest('.service-request');
            if (req) { req.style.opacity = '0.5';
                setTimeout(() => { req.style.display = 'none'; }, 500); }
        }

        function handlePharmacyOrder(action) {
            showToast(action === 'accept' ? '✅ Order accepted' : '✕ Order declined');
            const req = event.target.closest('.service-request');
            if (req) { req.style.opacity = '0.5';
                setTimeout(() => { req.style.display = 'none'; }, 500); }
        }

        // ================================================
        // NOTIFICATIONS
        // ================================================
        function showNotification() {
            alert('📬 Notifications\n\n1. 💳 Payment received: ₦5,000 from John Doe\n2. 📦 Low Stock Alert: Metformin 500mg\n3. 📋 New appointment request');
        }

        function showToast(msg) {
            const existing = document.querySelector('.toast-notification');
            if (existing) existing.remove();
            const toast = document.createElement('div');
            toast.className = 'toast-notification';
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.5s ease';
                setTimeout(() => toast.remove(), 500);
            }, 3000);
        }

        // ================================================
        // KEYBOARD SHORTCUTS
        // ================================================
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(m => m.remove());
            }
        });

        // ================================================
        // INIT
        // ================================================
        document.addEventListener('DOMContentLoaded', function() {
            // Restore avatar from localStorage
            const savedAvatar = localStorage.getItem('avatar');
            if (savedAvatar) {
                const img = document.getElementById('profile-avatar-img');
                const placeholder = document.getElementById('profile-avatar-placeholder');
                if (img) {
                    img.src = savedAvatar;
                    img.style.display = 'block';
                }
                if (placeholder) placeholder.style.display = 'none';
            }

            // If already logged in (token exists), skip splash and go to dashboard
            const token = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');

            navigateTo('splash');

            setTimeout(() => {
                if (token && storedUser) {
                    try {
                        currentUser = JSON.parse(storedUser);
                    } catch (e) { currentUser = null; }

                    const role = (currentUser && currentUser.role) ? currentUser.role : 'patient';
                    applyUserToUI(currentUser);

                    if (role === 'patient') navigateTo('patient-home');
                    else if (role === 'doctor') navigateTo('doctor-home');
                    else if (role === 'pharmacy') navigateTo('pharmacy-home');
                    else if (role === 'institution') navigateTo('institution-home');
                    else navigateTo('patient-home');
                } else {
                    navigateTo('auth');
                }
            }, 2500);

            checkNetwork();
            console.log('🏥 N-Health Loaded! Connected to backend at:', API_BASE_URL);
        });

        // Periodic network check
        
        // ================================================

    