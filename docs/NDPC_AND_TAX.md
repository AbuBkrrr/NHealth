# NDPC registration and tax: what to tell them and what's ready in the app

This is a checklist to take to the Nigeria Data Protection Commission (NDPC) and your tax adviser. It isn't legal or tax advice, and fees and thresholds change, so confirm current figures with them.

## 1. NDPC (data protection)

**Why N-Health must register:** N-Health processes health data, ID documents and locations for many people. Under the Nigeria Data Protection Act 2023 (NDPA) and the NDPC's General Application and Implementation Directive (GAID), that makes it a **data controller of major importance**.

**What to do:**
1. **Register** on the NDPC portal (ndpc.gov.ng). Health data usually places you in a higher tier. Have ready:
   - CAC certificate and RC number;
   - company address;
   - estimated number of users;
   - the kinds of data you process (below).
2. **Appoint a Data Protection Officer (DPO).** It can be a staff member or an outside firm. Set `DPO_EMAIL` on the server; the privacy policy shows it.
3. **Engage a licensed Data Protection Compliance Organisation (DPCO)** for the yearly **Compliance Audit Returns**, filed with the NDPC by the deadline it sets.
4. **Do a Data Protection Impact Assessment (DPIA)** for health data and location tracking. A DPCO can help; the table below is a starting point.
5. **Keep a record of processing**, using the table below.
6. **Breaches:** notify the NDPC within 72 hours of becoming aware of a breach, and tell affected people when the risk is high.

**What N-Health processes (for the registration and DPIA):**

| Data | Why | Where it's stored |
|---|---|---|
| Name, email, phone, address | Account, contact | Database on your VPS |
| Health profile, records, prescriptions, test results | Care the person asks for | Database; files in Cloudinary/private storage |
| ID documents, selfie, proof of address | Identity checks (KYC) | Private storage; only admins open them |
| Location | Emergencies, finding care nearby, ambulance tracking | Database |
| Payment references (no card numbers) | Payments | Database; cards handled by Paystack/Flutterwave |
| Marketing opens (random ID, device, city) | Measuring campaigns | Database (IP stored only as a hash) |

**Processors** (the NDPC asks about data sharing and transfers outside Nigeria):
- Paystack and Flutterwave (payments)
- PayScrow (escrow)
- Didit (identity)
- Resend (email)
- Meta WhatsApp Business (messages)
- Cloudinary (files)
- your VPS host

Get a data processing agreement (DPA) with each one. Most publish a standard DPA.

**Already in the app:**
- Consent at sign-up, with separate opt-ins for marketing and health-data sharing.
- People can download their data and delete their account (Settings → Privacy).
- Every time a provider opens a record, it's logged and the patient can see it.
- A privacy policy with the controller's identity, DPO contact, legal bases, processors, retention, rights and how to complain to the NDPC. Set `COMPANY_LEGAL_NAME`, `COMPANY_RC_NUMBER`, `COMPANY_ADDRESS` and `DPO_EMAIL` on the server so they appear.
- Marketing only to people who opted in, with unsubscribe and "Stop promotions".

## 2. Tax

The Nigeria Tax Act and Nigeria Tax Administration Act (in force from 2026) replaced several older tax laws. Confirm the current rates and thresholds with your tax adviser.

1. **Tax ID:** your company's tax identification number (linked to your CAC record), used for every filing.
2. **VAT:** register for VAT. Charge VAT on **N-Health's own income**: the commission taken from providers and the booking fee charged to patients. File monthly VAT returns.
   - Provider fees aren't N-Health's income, because they settle straight to providers.
   - Donations aren't N-Health's income: they go to the NGO or hospital, and N-Health takes no fee.
   - Ask whether medical services are VAT-exempt. Your commission is a platform service, and is usually taxable.
3. **Company income tax:** on N-Health's profit, filed yearly. Small companies below the turnover threshold may be exempt; check the current threshold.
4. **Withholding tax:** ask whether you must deduct withholding tax from payouts to providers. Payouts are only for coin-covered services, because card payments settle directly. Ask too whether it applies to fees you pay suppliers.
5. **PAYE:** for your own staff, through the state internal revenue service.
6. **Records:** Admin → Revenue shows N-Health's commission and booking-fee income by period. Use it for VAT returns. Admin → Fees & payouts shows the rates.

**Tell me if VAT must appear on receipts.** I can add VAT to the booking fee and commission lines on receipts and invoices, with a `VAT_RATE` setting.

## 3. The NGO partner (donations)
- The NGO should be registered with CAC as **Incorporated Trustees** (IT number).
- Its bank account, and a Paystack or Flutterwave **subaccount** for that account, go in Admin → Donation campaigns → Donation partner.
- Sign a short **partnership agreement** covering:
  - the NGO receives and disburses donations and issues receipts;
  - N-Health takes no fee on donations;
  - N-Health reviews campaigns;
  - the NGO reports disbursements to hospitals.
- The NGO files its own returns to CAC and the tax authority, which keeps N-Health out of charity-fundraising regulation.
