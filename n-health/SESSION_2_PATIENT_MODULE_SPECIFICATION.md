# Complete 13-Module Build Strategy - Full Specification

## MODULE BUILD ORDER & SPECIFICATIONS

### Session 2: PATIENT MODULE (IN PROGRESS)
**Status**: Service layer built ✅
**Remaining**: Routes + Controllers + UI + Tests

**Gap Coverage (16 features):**
- Gap 8: Medical history input ✅
- Gap 9: Allergy tracking ✅
- Gap 10: Current medications ✅
- Gap 11: Emergency contact ✅
- Gap 12: Family/dependents ✅
- Gap 13: Appointment rescheduling (partial)
- Gap 14: Appointment reminders (partial)
- Gap 15: Waitlist (partial)
- Gap 16: Provider favorites ✅
- Gap 17: Health records upload ✅
- Gap 18: Vitals tracking ✅
- Gap 19: Prescription refill reminders (partial)
- Gap 20: Referral letters (partial)
- Gap 21: Consent management (partial)
- Gap 22: Dependent insurance linking ✅

**What Still Needs Building:**
```
Routes: backend/src/routes/patient.routes.ts
Controllers: backend/src/controllers/patient.controller.ts
Pages: 
  - PatientHome.tsx (dashboard)
  - MedicalHistoryForm.tsx
  - AllergyManager.tsx
  - MedicationManager.tsx
  - EmergencyContacts.tsx
  - DependentsManager.tsx
  - HealthRecords.tsx
  - VitalsTracker.tsx
  - MyAppointments.tsx
  - InsuranceDetails.tsx
```

---

### Session 3: DOCTOR MODULE
**Gap Coverage (14 features):**
- Gap 23: Patient notes/history
- Gap 24: Diagnosis codes (ICD-10)
- Gap 25: Lab test ordering
- Gap 26: Referral to specialist
- Gap 27: Prescription templates
- Gap 28: Drug interaction checker
- Gap 29: SOAP notes
- Gap 30: Vitals recording
- Gap 31: Consultation types
- Gap 32: Follow-up scheduling
- Gap 33: Earnings breakdown
- Gap 34: Tax reports
- Gap 35: CPD tracking
- Gap 36: Patient consent before consult

**Services to Build:**
- DoctorService.ts
- PrescriptionService.ts
- ConsultationService.ts
- PatientNotesService.ts
- EarningsService.ts

**Routes/Controllers**: doctor.routes.ts, doctor.controller.ts

**UI Pages**:
- DoctorDashboard.tsx
- DoctorProfile.tsx
- PatientSearch.tsx
- PatientDetails.tsx
- ConsultationHistory.tsx
- PrescriptionForm.tsx
- EarningsReport.tsx
- AppointmentCalendar.tsx

---

### Session 4: PHARMACY MODULE
**Gap Coverage (14 features):**
- Gap 37: Expiry auto-alerts
- Gap 38: Batch number tracking
- Gap 39: Drug interaction warnings
- Gap 40: Generic substitution
- Gap 41: Prescription verification
- Gap 42: NAFDAC number lookup
- Gap 43: Supplier PO generation
- Gap 44: Reorder automation
- Gap 45: Delivery tracking
- Gap 46: Partial fulfillment
- Gap 47: Returns/refunds workflow
- Gap 48: Loyalty program
- Gap 49: Multi-branch support
- Gap 50: Stock transfer between branches

**Services to Build:**
- PharmacyService.ts
- InventoryService.ts
- OrderService.ts
- DeliveryService.ts
- RefundService.ts

**Routes/Controllers**: pharmacy.routes.ts, pharmacy.controller.ts

**UI Pages**:
- PharmacyDashboard.tsx
- ProductCatalog.tsx
- InventoryManager.tsx
- OrderManagement.tsx
- DeliveryTracking.tsx
- PrescriptionVerification.tsx

---

### Session 5: APPOINTMENT MODULE
**Gap Coverage (10 features):**
- Gap 106: Appointment types
- Gap 107: Duration selection
- Gap 108: Buffer time
- Gap 109: Recurring appointments
- Gap 110: Waitlist
- Gap 111: Appointment reason
- Gap 112: Pre-visit questionnaire
- Gap 113: Video call link
- Gap 114: Calendar sync
- Gap 115: Group appointments

**Services to Build:**
- AppointmentService.ts
- CalendarService.ts
- VideoCallService.ts
- WaitlistService.ts

**Routes/Controllers**: appointment.routes.ts, appointment.controller.ts

**UI Pages**:
- CalendarView.tsx
- BookingFlow.tsx (7-step)
- MyAppointments.tsx
- AppointmentDetails.tsx
- RescheduleFlow.tsx

---

### Session 6: PAYMENT MODULE
**Gap Coverage (13 features):**
- Gap 69: Partial payments
- Gap 70: Installment plans
- Gap 71: Refund automation
- Gap 72: Multi-currency
- Gap 73: Payment receipts by email
- Gap 74: Payment reminders
- Gap 75: Payment dispute workflow
- Gap 76: Payment splitting
- Gap 77: Payment plans for labs
- Gap 78-81: UI/pricing gaps

**Services to Build:**
- PaymentService.ts
- PaystackService.ts (Paystack integration)
- FlutterWaveService.ts
- ReceiptService.ts
- RefundService.ts

**Routes/Controllers**: payment.routes.ts, payment.controller.ts

**UI Pages**:
- CheckoutFlow.tsx
- PaymentHistory.tsx
- ReceiptView.tsx
- RefundRequest.tsx
- SubscriptionPlans.tsx

---

### Session 7: LAB MODULE
**Gap Coverage (10 features):**
- Gap 51: Test catalog management
- Gap 52: Reference ranges
- Gap 53: Result flagging (H/L)
- Gap 54: Result history comparison
- Gap 55: Lab accreditation info
- Gap 56: Sample collection scheduling
- Gap 57: Barcode sample tracking
- Gap 58: Result verification by pathologist
- Gap 59: Critical value alerts
- Gap 60: PDF attachment of images

**Services to Build:**
- LabService.ts
- TestCatalogService.ts
- ResultService.ts
- SampleTrackingService.ts

**Routes/Controllers**: lab.routes.ts, lab.controller.ts

**UI Pages**:
- LabDashboard.tsx
- TestCatalog.tsx
- BookSampleCollection.tsx
- ResultHistory.tsx
- ResultDetails.tsx

---

### Session 8: AMBULANCE MODULE
**Gap Coverage (10 features):**
- Gap 61: Real-time ambulance tracking
- Gap 62: Nearest-ambulance dispatch
- Gap 63: Multi-ambulance support
- Gap 64: Hospital capacity check
- Gap 65: Medical equipment tracking
- Gap 66: Driver/paramedic profiles
- Gap 67: Emergency history for patient
- Gap 68: Insurance coverage check
- Gap 69: Diversion to nearest hospital
- Gap 70: Handover documentation

**Services to Build:**
- AmbulanceService.ts
- DispatchService.ts
- LocationTrackingService.ts
- HospitalService.ts
- DriverService.ts

**Routes/Controllers**: ambulance.routes.ts, ambulance.controller.ts

**UI Pages**:
- EmergencySOS.tsx
- AmbulanceTracking.tsx
- DriverInfo.tsx
- HospitalSelection.tsx
- EmergencyHistory.tsx

---

### Session 9: NURSE MODULE
**Gap Coverage (7 features):**
- Gap 71: Care plan creation
- Gap 72: Vitals recording
- Gap 73: Medication administration log
- Gap 74: Wound care documentation
- Gap 75: Shift scheduling
- Gap 76: Multiple patient assignment
- Gap 77: Nursing notes

**Services to Build:**
- NurseService.ts
- CarePlanService.ts
- ShiftService.ts
- MedicationAdminService.ts

**Routes/Controllers**: nurse.routes.ts, nurse.controller.ts

**UI Pages**:
- NurseDashboard.tsx
- PatientAssignment.tsx
- CarePlanForm.tsx
- VitalsRecording.tsx
- ShiftSchedule.tsx
- MedicationAdminLog.tsx

---

### Session 10: INSURANCE/NHIS MODULE
**Gap Coverage (9 features):**
- Gap 88: Real-time NHIS verification
- Gap 89: Claims submission
- Gap 90: Eligibility check before booking
- Gap 91: Coverage limits display
- Gap 92: Pre-authorization requests
- Gap 93: Claim tracking
- Gap 94: HMO directory
- Gap 95: Co-pay calculation
- Gap 96: Insurance card QR

**Services to Build:**
- InsuranceService.ts
- NHISService.ts
- ClaimsService.ts
- CoverageService.ts

**Routes/Controllers**: insurance.routes.ts, insurance.controller.ts

**UI Pages**:
- InsuranceDetails.tsx
- CoverageViewer.tsx
- ClaimsSubmission.tsx
- ClaimTracking.tsx
- PreAuthRequest.tsx

---

### Session 11: MESSAGING MODULE
**Gap Coverage (8 features):**
- Gap 116: File sharing
- Gap 117: Voice messages
- Gap 118: Read receipts
- Gap 119: Message search
- Gap 120: Group chats
- Gap 121: Message encryption
- Gap 122: Message translation
- Gap 123: Auto-reply

**Services to Build:**
- MessagingService.ts
- ChatService.ts
- FileUploadService.ts
- EncryptionService.ts

**Routes/Controllers**: messaging.routes.ts, messaging.controller.ts

**UI Pages**:
- ChatList.tsx
- ChatWindow.tsx
- GroupChat.tsx
- MessageSearch.tsx
- FileSharing.tsx

---

### Session 12: NOTIFICATIONS & DONATIONS COMBINED
**Notifications (5 features):**
- Gap 124: Push notification
- Gap 125: SMS fallback
- Gap 126: Notification preferences
- Gap 127: Notification history
- Gap 128: Scheduled notifications

**Donations (9 features):**
- Gap 97: Blood type matching
- Gap 98: Organ donation registry
- Gap 99: Donation history
- Gap 100: Tax receipts
- Gap 101: Recurring donations
- Gap 102: Fundraiser creation
- Gap 103: Share links
- Gap 104: Donor anonymity option
- Gap 105: Milestone notifications

**Services to Build:**
- NotificationService.ts
- DonationService.ts
- BloodBankService.ts
- FundraiserService.ts

**Routes/Controllers**: notifications.routes.ts, donations.routes.ts

**UI Pages**:
- NotificationCenter.tsx
- DonationHub.tsx
- CreateFundraiser.tsx
- DonationHistory.tsx
- BloodBankSearch.tsx

---

### Session 13: ADMIN MODULE
**Gap Coverage (8 features):**
- Gap 129: Provider verification workflow
- Gap 130: License verification
- Gap 131: Document upload for verification
- Gap 132: Audit trail for medical records
- Gap 133: Bulk user import
- Gap 134: User activity log
- Gap 135: Data export
- Gap 136: Regulatory reports

**Services to Build:**
- AdminService.ts
- VerificationService.ts
- AuditService.ts
- ReportService.ts

**Routes/Controllers**: admin.routes.ts, admin.controller.ts

**UI Pages**:
- AdminDashboard.tsx
- UserManagement.tsx
- VerificationQueue.tsx
- AuditLog.tsx
- ReportGenerator.tsx

---

## IMPLEMENTATION PATTERN (Repeat for Each Module)

### Step 1: Service Layer (12-15 KB per service)
```typescript
export class [Module]Service {
  async create() { }
  async read() { }
  async update() { }
  async delete() { }
  async [specific business logic]() { }
}
```

### Step 2: Routes (8-10 KB)
```typescript
router.post('/[module]', authMiddleware, create[Module]);
router.get('/[module]/:id', authMiddleware, get[Module]);
router.patch('/[module]/:id', authMiddleware, update[Module]);
router.delete('/[module]/:id', authMiddleware, delete[Module]);
```

### Step 3: Controllers (10-12 KB)
```typescript
export const create[Module] = async (req, res) => {
  const { /* data */ } = req.body;
  const result = await [Module]Service.create(data);
  res.json(result);
};
```

### Step 4: UI Pages (8-15 KB each)
- Dashboard page
- List/Search page
- Detail/Edit page
- Create/Form page
- History/Analytics page

### Step 5: Database Models (Prisma)
```prisma
model [Module] {
  id String @id @default(cuid())
  /* fields */
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## TOTAL BUILD ESTIMATE

| Module | Service | Routes | Controllers | UI Pages | Database | Total |
|--------|---------|--------|-------------|----------|----------|-------|
| Patient | 16KB | 8KB | 10KB | 35KB | 5 models | 40 hours |
| Doctor | 18KB | 10KB | 12KB | 40KB | 6 models | 45 hours |
| Pharmacy | 15KB | 9KB | 11KB | 38KB | 5 models | 35 hours |
| Appointment | 12KB | 8KB | 9KB | 30KB | 4 models | 30 hours |
| Payment | 14KB | 9KB | 10KB | 32KB | 4 models | 25 hours |
| Lab | 13KB | 8KB | 9KB | 28KB | 4 models | 25 hours |
| Ambulance | 14KB | 9KB | 10KB | 30KB | 4 models | 30 hours |
| Nurse | 11KB | 7KB | 8KB | 25KB | 3 models | 20 hours |
| Insurance | 13KB | 8KB | 9KB | 28KB | 4 models | 25 hours |
| Messaging | 12KB | 8KB | 9KB | 28KB | 3 models | 25 hours |
| Notifications | 10KB | 6KB | 7KB | 20KB | 2 models | 15 hours |
| Donations | 11KB | 7KB | 8KB | 24KB | 3 models | 20 hours |
| Admin | 12KB | 8KB | 9KB | 28KB | 3 models | 30 hours |
| **TOTAL** | **161KB** | **102KB** | **121KB** | **365KB** | **49 models** | **365 hours** |

---

## NEXT SESSION: Completing Patient Module

**What will be delivered in next message:**

1. ✅ PatientService.ts (done)
2. ⏭️ patient.routes.ts (20 endpoints)
3. ⏭️ patient.controller.ts (handlers)
4. ⏭️ PatientHome.tsx (dashboard)
5. ⏭️ MedicalHistoryForm.tsx
6. ⏭️ AllergyManager.tsx
7. ⏭️ MedicationManager.tsx
8. ⏭️ EmergencyContacts.tsx
9. ⏭️ DependentsManager.tsx
10. ⏭️ HealthRecords.tsx
11. ⏭️ VitalsTracker.tsx
12. ⏭️ MyAppointments.tsx
13. ⏭️ InsuranceDetails.tsx
14. ⏭️ Prisma database models
15. ⏭️ Unit tests

**Estimated output: 200+ KB of production code**

---

## How to Scale Across 13 Sessions

Each session will follow this pattern:
1. **Start**: Service layer
2. **Middle**: Routes, controllers, UI
3. **End**: Tests + commit + document

By Session 13, you'll have:
- ✅ 13 complete modules
- ✅ 1,500+ lines of service code
- ✅ 800+ lines of routes
- ✅ 1,000+ lines of controllers
- ✅ 3,000+ lines of UI components
- ✅ 50 database models
- ✅ Full healthcare platform

**Ready to proceed with Patient Module completion in the next message?**

