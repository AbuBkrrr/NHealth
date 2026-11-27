# Regulatory checklist (to review with a Nigerian lawyer)

This is **not legal advice**. It lists the areas where N-Health's features touch Nigerian regulation, so you can confirm each one with a lawyer who practises health, fintech and data-protection law. Several of these generally **do** need registration, a licence or a partner that holds one.

| Area | What N-Health does | Who regulates it | What to confirm |
|---|---|---|---|
| Health data | Stores medical records, identity documents, location | Nigeria Data Protection Commission (NDPA 2023) | Registration as a data controller/processor of major importance; annual compliance audit; a Data Protection Officer; data protection impact assessment for health data; consent wording; cross-border transfer (hosting) |
| Telemedicine and doctors | Video/chat consultations, prescriptions | Medical and Dental Council of Nigeria (MDCN); Federal Ministry of Health | Rules for telemedicine and e-prescribing; that every doctor on the platform holds a current MDCN licence (the app checks documents, not the council register) |
| Medicines | Pharmacy orders and delivery, medicine search | Pharmacists Council of Nigeria (PCN); NAFDAC | Premises licences for pharmacies; rules for online sale and delivery of medicines; prescription-only medicines (the app requires a prescription for those) |
| Facilities and diagnostics | Hospitals, clinics, diagnostic centers, blood banks listed and booking | State ministries of health; MLSCN; RRBN; National Blood Service Agency | Facility registration for providers on the platform; blood services rules |
| Ambulances | Emergency dispatch | State ministries of health / emergency services | Ambulance operating licences for operators on the platform |
| Coins (stored value) | Prepaid coins bought with naira, spent in-app, never withdrawn | Central Bank of Nigeria | Whether closed-loop prepaid credits need a licence or a licensed partner. Showing "coins" instead of naira does **not** by itself change this: what matters is that coins are sold for money, held, and used for payments. Keep them closed-loop, non-transferable and non-refundable to cash, and get written advice |
| Payments, escrow, split payments | Paystack/Flutterwave/PayScrow checkouts, payouts to providers | Central Bank of Nigeria | That money moves only through licensed processors (it does), and whether holding balances or escrow for providers needs more |
| Health insurance | Insurance plans, NHIA numbers, HMO listing | National Health Insurance Authority (NHIA); NAICOM | Selling or administering health plans in-app generally needs NHIA accreditation or doing it through accredited HMOs; listing HMOs is fine |
| Donations and fundraising | Patient medical-bill campaigns, blood requests | Corporate Affairs Commission; SEC (crowdfunding rules); FCCPC | Whether donation campaigns fall under charity/crowdfunding rules; how funds are held and released |
| Health jobs | Providers post jobs, workers apply | Federal Ministry of Labour and Employment | Whether running a job board/recruitment service needs a private employment agency licence (it may if N-Health places workers or charges fees) |
| Marketing | SMS/email broadcasts, tracking links, ad pixels | NCC (unsolicited SMS rules); NDPC; FCCPC | Opt-in and opt-out (the app has both), sender ID registration for SMS |
| Consumer protection | Prices, refunds, reviews | FCCPC (FCCPA 2018) | Clear prices before payment (shown in naira when buying coins), refund policy, terms of service |
| Tax | Commissions, fees | FIRS / state revenue | VAT on N-Health's fees and commissions; withholding on provider payouts |
| The company | All | Corporate Affairs Commission | Registered company with objects covering these activities |

**Bottom line:** N-Health is a marketplace for regulated services, so the providers on it need their own licences, and the platform itself very likely needs at least:
- NDPC registration
- licensed partners (or its own licences) for payments and stored value, health insurance and possibly recruitment

Get these confirmed before scaling.
