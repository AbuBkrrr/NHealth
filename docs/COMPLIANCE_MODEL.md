# How N-Health runs without extra licences

N-Health is a **technology marketplace**. The licensed providers on it deliver care, and **N-Health never holds anyone's money.** Every feature stays, but each one is set up so the licence sits with the provider or a licensed partner.

This is a summary for discussion with your lawyer, not legal advice.

| Feature | How it works now | Who holds the licence |
|---|---|---|
| Doctors, nurses, telemedicine, prescriptions | Only verified, licensed professionals can take work; N-Health doesn't practise medicine | Each professional (MDCN, NMCN) |
| Pharmacy orders and delivery | The pharmacy sells, prices and delivers; prescription-only medicines need a prescription | The pharmacy (PCN premises licence). Ask your lawyer whether PCN's online-pharmacy guidelines also need N-Health listed |
| Diagnostic centres, home sample collection | The centre collects samples and reports results | The centre (MLSCN / RRBN) |
| Ambulances | N-Health dispatches licensed operators. No balance is needed to call one, and 112/767 are always shown | The operator (state licence) |
| Hospitals, facility directory, emergency arrivals | Public directory; hospitals are verified when they join or claim a listing | The hospital (state ministry of health) |
| **Payments** | Card, transfer and USSD go through Paystack/Flutterwave **split payments**, which settle each provider's share **straight into the provider's own account**. If a provider has no split subaccount yet, card payment is refused and the patient pays cash at the service. Escrow, where used, is held by PayScrow (confirm PayScrow's licence). N-Health only keeps its commission and booking fee | Paystack, Flutterwave (CBN-licensed); PayScrow |
| **Coins** | Free rewards only (invites, promotions), never sold, and can't be transferred or cashed out. When used, N-Health pays the provider from its own funds. See [COINS_AND_INVITES.md](COINS_AND_INVITES.md) | Not stored value, so no CBN licence |
| Provider earnings balance and payouts | Holds only what N-Health owes providers from its own money (coins used) and records cash commissions. Payouts go through Paystack/Flutterwave Transfers | Paystack, Flutterwave |
| **Donations** | Money donations go straight into the **partner NGO's** account (Admin → Donation campaigns → Donation partner), or the treating hospital's when no NGO is set. Payment is by card (100% split to their account, 0% to N-Health) or bank transfer to them, which they confirm. Coins can't be donated. Campaigns are reviewed before going live | The NGO (CAC incorporated trustees) or the hospital |
| Blood | Listing and pledges only. Shown in the app: blood is never bought or sold | Blood banks and hospitals (NBSA) |
| Organ donation | A pledge register of the person's wishes. No matching and no payment; transplants are arranged by licensed hospitals | Hospitals (National Health Act) |
| **Health insurance** | N-Health lists plans and accredited HMOs. "Request enrolment" passes the request to the HMO; the HMO enrols the person and collects the premium. N-Health never collects premiums | The HMO (NHIA) |
| Health jobs | A free job board. Job seekers are never charged and employers choose who to hire, so N-Health isn't acting as a recruitment agency | — |
| Messages | In-app, email and WhatsApp only (**no SMS**). Marketing goes only to people who opted in, with an opt-out | Meta (WhatsApp Business policy); NDPC (consent) |
| Identity checks | Didit, or the in-app form reviewed by N-Health staff. NIN is checked only through licensed partners | Didit / NIMC-licensed partners |

## What N-Health itself still needs
- **CAC:** done.
- **NDPC registration and NDPA compliance.** You hold health data. See [NDPC_AND_TAX.md](NDPC_AND_TAX.md).
- **Tax:** a Tax ID, VAT on your commissions and fees, and annual returns. See [NDPC_AND_TAX.md](NDPC_AND_TAX.md).
- **WhatsApp Business account** approved by Meta. See [WHATSAPP.md](WHATSAPP.md).

## Settings that keep it this way
- `COIN_TOPUP_ENABLED=false` (the default): coins can't be bought.
- **Admin → Donation campaigns → Donation partner:** your NGO's name, CAC number, account and Paystack/Flutterwave subaccount.
- **Every provider needs a bank account** in Earnings & payouts before patients can pay them by card. N-Health creates the split subaccount automatically. Admin → Integration status shows how many can take cards.
- `COMPANY_LEGAL_NAME`, `COMPANY_RC_NUMBER`, `COMPANY_ADDRESS`, `DPO_EMAIL`: shown on the privacy policy and terms.
