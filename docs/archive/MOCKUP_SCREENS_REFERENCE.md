# 📱 N-HEALTH MOCKUP SCREENS - COMPLETE REFERENCE GUIDE

**Last Updated**: September 2, 2026  
**All Screens**: ✅ Live & Responsive  
**Live URL**: https://admin-pr3me3jod-budget-pro.vercel.app  

---

## 🌐 HOW TO TEST ALL SCREENS

### Step 1: Visit the Live App
Go to: **https://admin-pr3me3jod-budget-pro.vercel.app**

### Step 2: Select Role on Login
Choose between:
- 👤 **Patient** → Patient Dashboard
- 🏥 **Provider** → Provider Type Selection

### Step 3: Enter Demo Credentials
```
Username: [role]@demo.com
Password: password123

Examples:
- patient@demo.com
- doctor@demo.com
- nurse@demo.com
- pharmacy@demo.com
- lab@demo.com
- ambulance@demo.com
- admin@demo.com
```

### Step 4: Explore Dashboard
Click through all 6 tabs (or relevant admin screens)

### Step 5: Test Responsiveness
- Open DevTools (F12)
- Toggle device toolbar
- Test on iPhone 12, iPad, Desktop

---

## 📱 ALL AVAILABLE SCREENS

### 🔐 AUTHENTICATION SCREENS

#### 1. **Login Page** (/login)
**Phone Frame**: ✅ 390×844px  
**Elements**:
- Status bar (9:41, signal, battery)
- App bar (N-Health logo)
- Role selection (Patient | Provider buttons)
- Email input field
- Password input field (••••••••)
- "Sign In" button
- "Don't have account?" link to signup

**Design**:
- 2-step flow (role → credentials)
- Blue gradient button
- Responsive on all devices
- Touch-optimized buttons

**Test**: patient@demo.com / password123

---

#### 2. **Signup Page** (/signup)
**Phone Frame**: ✅ 390×844px  
**Multi-Step Flow**:

**Step 1: Role Selection**
- Patient button
- Provider button

**Step 2: Provider Type** (if Provider selected)
- Doctor option
- Nurse option
- Pharmacy option
- Lab option
- Ambulance option

**Step 3: Details**
- First name input
- Last name input
- Email input
- Phone number input

**Step 4: Password**
- Password input (8+ chars required)
- Confirm password input
- Terms & conditions checkbox

**Step 5: Success**
- Success checkmark animation
- "Account Created!" message
- Auto-redirect to dashboard

**Design**:
- Progressive disclosure
- Back button on each step
- Validation messages
- Error highlighting
- Success animation

---

### 👤 PATIENT DASHBOARD

**URL**: Automatic (role-based routing)  
**Phone Frame**: ✅ 390×844px  
**Navigation Tabs**: 🏠 Home | 🚨 Emergency | 📅 Bookings | 💊 Pharmacy | 🏥 Providers | 👤 Profile

#### **HOME Tab**
```
Layout:
┌─────────────────────┐
│  Status Bar (9:41)  │
├─────────────────────┤
│  N-Health 🔔 👤    │
├─────────────────────┤
│  Greeting (Hello 👋)│
├─────────────────────┤
│  Wallet Card        │
│  ₦245,750.00       │
│  💰 Fund | 📋 Hist│
├─────────────────────┤
│ Quick Actions       │
│ 🚨 🗓 💊 🧬         │
│ 🏥 ❤ 🛡 💬        │
├─────────────────────┤
│ Upcoming            │
│ □ Dr Chidi          │
│ □ Nurse Funmi      │
├─────────────────────┤
│ [Bottom Nav - 6 tabs]│
└─────────────────────┘
```

**Features**:
- Wallet balance with NHIS status
- Quick action grid (8 buttons)
- Upcoming appointments preview
- Profile access from top right
- Emergency SOS button

---

### 👨‍⚕️ DOCTOR DASHBOARD

**URL**: Automatic (role-based routing)  
**Phone Frame**: ✅ 390×844px  
**Navigation Tabs**: 🏠 Home | 📅 Appts | 👥 Patients | 💰 Earnings | 💬 Messages | 👤 Profile

#### **HOME Tab**
```
Layout:
┌─────────────────────┐
│  Status Bar (9:41)  │
├─────────────────────┤
│ Dr. Chidi 🔔 👤   │
├─────────────────────┤
│ Welcome back 👋    │
│ Cardiologist • Lagos│
├─────────────────────┤
│ Stats Grid (2x2):   │
│ 📅 12 Today         │
│ 💰 ₦45K Earnings    │
│ ⭐ 4.8 Rating      │
│ 👥 127 Patients     │
├─────────────────────┤
│ Today's Schedule    │
│ □ Amara Okafor      │
│ □ John Adeyemi      │
├─────────────────────┤
│ Quick Actions (4)   │
│ 📞 💭 💊 📊        │
├─────────────────────┤
│ [Bottom Nav - 6 tabs]│
└─────────────────────┘
```

**Additional Tabs**:
- **Appointments**: Full appointment list
- **Patients**: Patient roster
- **Earnings**: Income tracking
- **Messages**: Inbox
- **Profile**: Doctor info & settings

---

### 👩‍⚕️ NURSE DASHBOARD

**URL**: Automatic (role-based routing)  
**Phone Frame**: ✅ 390×844px  
**Navigation Tabs**: 🏠 Home | 👥 Patients | 📅 Schedule | 🩺 Vitals | 💬 Messages | 👤 Profile

#### **HOME Tab**
```
Layout:
┌─────────────────────┐
│  Status Bar (9:41)  │
├─────────────────────┤
│ Nurse Funmi 🔔 👤 │
├─────────────────────┤
│ Welcome, Funmi 👋  │
│ General Ward        │
├─────────────────────┤
│ Shift Card (Blue)   │
│ 7:30 AM - 3:30 PM  │
│ 8 Patients         │
│ 3 Critical | 2 Pend│
├─────────────────────┤
│ Quick Actions (4):  │
│ 🩺 💊 📋 🚑        │
├─────────────────────┤
│ Assigned Patients   │
│ 📍 Room 304        │
│ □ Amara Okafor      │
│ □ John Adeyemi      │
├─────────────────────┤
│ [Bottom Nav - 6 tabs]│
└─────────────────────┘
```

**Additional Tabs**:
- **Patients**: Patient monitoring
- **Schedule**: Shift schedule
- **Vitals**: Vital signs (BP, HR, O2, Temp)
- **Messages**: Team messages
- **Profile**: Nurse info

---

### 💊 PHARMACY DASHBOARD

**URL**: Automatic (role-based routing)  
**Phone Frame**: ✅ 390×844px  
**Navigation Tabs**: 🏠 Home | 📦 Stock | 📋 Orders | 💰 Sales | 💬 Messages | 👤 Profile

#### **HOME Tab**
```
Layout:
┌─────────────────────┐
│  Status Bar (9:41)  │
├─────────────────────┤
│ Pharmacy Plus 🔔   │
├─────────────────────┤
│ Welcome back 👋    │
│ Lekki Branch        │
├─────────────────────┤
│ Sales Card (Blue)   │
│ ₦87,500            │
│ 24 orders today     │
├─────────────────────┤
│ Stats Grid (3):     │
│ 📦 1,240 Stock      │
│ ⏳ 8 Pending        │
│ ✅ 24 Completed     │
├─────────────────────┤
│ Quick Actions (4):  │
│ 🛒 📦 🔍 📊        │
├─────────────────────┤
│ Pending Orders      │
│ □ Amara - ₦15,500  │
│ □ John - ₦8,200    │
├─────────────────────┤
│ [Bottom Nav - 6 tabs]│
└─────────────────────┘
```

**Additional Tabs**:
- **Inventory**: Stock management
- **Orders**: Order fulfillment
- **Sales**: Revenue tracking
- **Messages**: Customer messages
- **Profile**: Pharmacy info

---

### 🔬 LAB DASHBOARD

**URL**: Automatic (role-based routing)  
**Phone Frame**: ✅ 390×844px  
**Navigation Tabs**: 🏠 Home | 🧪 Tests | 📊 Results | 🧬 Samples | 💬 Messages | 👤 Profile

#### **HOME Tab**
```
Layout:
┌─────────────────────┐
│  Status Bar (9:41)  │
├─────────────────────┤
│ ProLab 🔔 👤      │
├─────────────────────┤
│ Welcome back 👋    │
│ Lagos Central Lab   │
├─────────────────────┤
│ Lab Card (Blue):    │
│ Today's Tests: 42   │
│ ✅ 28 Done          │
│ ⏳ 14 Pending       │
├─────────────────────┤
│ Stats Grid (3):     │
│ 🧪 1,240 Samples    │
│ 📊 98% Accuracy     │
│ ⭐ 4.9 Rating      │
├─────────────────────┤
│ Quick Actions (4):  │
│ 🧬 📋 🔬 📊        │
├─────────────────────┤
│ Recent Tests        │
│ □ Amara - FBC       │
│ □ John - COVID-19   │
├─────────────────────┤
│ [Bottom Nav - 6 tabs]│
└─────────────────────┘
```

**Additional Tabs**:
- **Tests**: Test ordering
- **Results**: Result reporting
- **Samples**: Sample tracking
- **Messages**: Lab messages
- **Profile**: Lab info

---

### 🚑 AMBULANCE DASHBOARD

**URL**: Automatic (role-based routing)  
**Phone Frame**: ✅ 390×844px  
**Navigation Tabs**: 🏠 Home | 🚨 Requests | 🚑 Active | 📋 History | 💬 Messages | 👤 Profile

#### **HOME Tab**
```
Layout:
┌─────────────────────┐
│  Status Bar (9:41)  │
├─────────────────────┤
│ Rapid Response 🔔  │
├─────────────────────┤
│ Status: On Duty 🟢  │
├─────────────────────┤
│ Status Card (Blue): │
│ 🚑 Unit #7          │
│ Available • 2 Staff │
├─────────────────────┤
│ Stats Grid (3):     │
│ 📍 12 Today         │
│ ✅ 98% Success      │
│ ⭐ 4.9 Rating      │
├─────────────────────┤
│ Quick Actions (4):  │
│ 🟢 📍 📞 📊        │
├─────────────────────┤
│ New Requests        │
│ 🔴 VI, Lagos - 5m   │
│ 🟡 Lekki - 10m      │
├─────────────────────┤
│ [Bottom Nav - 6 tabs]│
└─────────────────────┘
```

**Additional Tabs**:
- **Requests**: Emergency requests list
- **Active**: Current trip details
- **History**: Trip history
- **Messages**: Dispatch messages
- **Profile**: Vehicle info

---

### 🔐 ADMIN DASHBOARD

**URL**: Automatic (admin role)  
**Admin Tabs**: 📊 Dashboard | 👥 Users | 🔑 Admins | 📋 Audit Log

#### **Features**:
- User management
- Admin controls
- Audit logging
- System monitoring

---

## 🎨 DESIGN SPECIFICATIONS

### Phone Frame Dimensions
```
Width:  390px (iPhone 12, 13, 14)
Height: 844px
Border: 12px solid black
Border-Radius: 40px
Notch: 120px × 24px at top

Status Bar:
- Time: 9:41
- Signal: 📶 📡
- Battery: 87%
```

### Navigation Bottom Bar
```
6 Tabs per dashboard
Each tab has:
- Icon (20px emoji)
- Label (8px text)
- Active state: Color shift + scale
- Inactive state: Gray

Height: 60px
Position: Sticky at bottom
```

### Color Palette
```
Primary:       #1A73E8 (Google Blue)
Primary Dark:  #0D47A1 (Navy)
Primary Light: #E8F0FE (Light Blue)
Success:       #34A853 (Green)
Warning:       #FBBC04 (Yellow)
Error:         #EA4335 (Red)
Text Primary:  #202124 (Dark Gray)
Text Secondary: #5F6368 (Medium Gray)
Text Light:    #9AA0A6 (Light Gray)
Surface:       #F5F7FA (Off White)
```

### Typography
```
Heading 1: 26px, 700 weight (H1)
Heading 2: 20px, 700 weight (Section titles)
Heading 3: 14px, 600 weight (Card titles)
Body:      14px, 400 weight (Main text)
Label:     12px, 600 weight (Labels)
Micro:     11px, 500 weight (Small text)
```

### Spacing
```
Base Unit: 4px (multiply by 4, 8, 12, 16, 20, 24, 32)
Button Padding: 12px
Input Padding: 12px
Card Padding: 16px
Gap Grid: 10px
Border Radius: 8px-12px
```

---

## 📲 RESPONSIVE TESTING GUIDE

### Test on Mobile (390px)
1. Open DevTools (F12)
2. Click "Toggle device toolbar"
3. Select "iPhone 12"
4. View should match phone frame exactly
5. All text readable
6. Buttons clickable
7. No horizontal scroll

### Test on Tablet (768px)
1. Select "iPad" in device toolbar
2. Phone frame should be centered
3. All content visible
4. Proper touch targets
5. No text cutoff

### Test on Desktop (1024px+)
1. Select "Desktop" or maximize browser
2. Phone frame centered on page
3. Multiple columns visible
4. Full layout shown
5. Optimal spacing

---

## ✅ VERIFICATION CHECKLIST

### For Each Dashboard:

- [ ] Phone frame displays correctly
- [ ] All 6 tabs visible in bottom nav
- [ ] Tab clicking works (changes view)
- [ ] Active tab highlighted (blue + larger)
- [ ] Content scrolls vertically
- [ ] No horizontal scroll
- [ ] Status bar shows (9:41)
- [ ] App bar shows role/name
- [ ] All buttons responsive to clicks
- [ ] Proper hover/active states
- [ ] Colors match design spec
- [ ] Text sizes readable
- [ ] Images load correctly
- [ ] Responsive on all breakpoints

---

## 🧪 QUICK TEST FLOW

1. **Login**: patient@demo.com / password123
2. **Verify**: Patient Dashboard loads
3. **Check Tabs**: 
   - 🏠 Home - Wallet visible
   - 🚨 Emergency - Emergency SOS
   - 📅 Bookings - Appointments
   - 💊 Pharmacy - Drug search
   - 🏥 Providers - Doctor search
   - 👤 Profile - User settings
4. **Test Responsive**: F12 → Responsive mode → iPhone 12
5. **Verify**: Phone frame looks correct
6. **Logout**: Top right menu
7. **Signup Test**: Create new account
8. **Verify**: New account works

---

## 📞 DASHBOARD ACCESS

**All dashboards are accessed via role-based routing:**

```
URL: https://admin-pr3me3jod-budget-pro.vercel.app

Login with different roles:
- patient@demo.com → Patient Dashboard
- doctor@demo.com → Doctor Dashboard
- nurse@demo.com → Nurse Dashboard
- pharmacy@demo.com → Pharmacy Dashboard
- lab@demo.com → Lab Dashboard
- ambulance@demo.com → Ambulance Dashboard
- admin@demo.com → Admin Dashboard

Password for all: password123
```

---

## 🎊 COMPLETE SCREEN REFERENCE

**Total Screens Available**: 7+ fully responsive dashboards  
**Total Tabs**: 42+ (6 tabs × 7 dashboards)  
**Phone Frame**: ✅ 390×844px on all screens  
**Responsive**: ✅ Mobile, Tablet, Desktop  
**Status**: ✅ All Live & Tested  

---

**Live URL**: https://admin-pr3me3jod-budget-pro.vercel.app  
**Ready for**: Testing, Feedback, Production Launch

**Explore all mockup screens now!** 🚀

