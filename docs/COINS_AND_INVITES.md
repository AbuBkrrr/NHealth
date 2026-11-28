# Coins and invite rewards

## Coins are a free reward, like loyalty points
- **How people get coins** (the Muslim Pro model: earned through activity, never bought):
  - **Health quests** (see below);
  - inviting friends (see below);
  - promotions an admin grants;
  - coins returned when a booking paid with coins is cancelled.
- **Coins are never sold.**
  - Buying coins is switched off (`COIN_TOPUP_ENABLED=false`), so the top-up screen is gone and the API refuses top-ups.
  - Selling coins for naira and letting people pay providers with them would be stored value, which needs a CBN licence or a licensed partner. See [COMPLIANCE_MODEL.md](COMPLIANCE_MODEL.md).
- **Coins can't be withdrawn, moved into another person's balance or exchanged for cash.** The terms of service say so, and the app enforces it.
- **Helping someone pay for care** (My coins → Help someone), the licence-free alternative to transfers:
  1. The sender finds a member by phone, email, N-Health ID or user ID.
  2. They confirm the profile (name, photo, masked phone and email, member since, verified badges), choose coins and send.
  3. The coins leave the sender's balance but **never enter the recipient's balance**. The recipient applies the offer to one of **their own unpaid bills**, and the provider is paid for that part by N-Health, as with any coin payment.
  4. Unused, declined, cancelled or expired (7 days) coins go back to the sender. If the bill is later cancelled, the coins go back to the sender, never to the recipient.

  Limits:
  - up to 500 coins offered per person per day;
  - recipients must have confirmed their email or phone;
  - the pharmacy rule applies (delivery and over-the-counter items only).

  Person-to-person transfers into another person's balance would make coins transferable stored value, which needs a CBN licence. This design avoids that.
- **Using coins:** for a booking, pharmacy order, test or home-care visit:
  - **All of the bill:** choose **Pay it all with my coins** if they have enough.
  - **Part of the bill:** tick **Use some of my coins and pay the rest**, choose how many, then pay what's left by card or cash. The bill, the booking card and the cash amount the provider collects all show the coins taken off.
  - Coins on part of a bill can be **removed** before paying, and are **returned** if the bill is cancelled.
  - **Pharmacy orders:** coins can pay the **delivery fee** (set by each pharmacy in its practice details) and **over-the-counter items**, but not **prescription-only medicines**. Nigerian rules restrict inducements to buy prescription medicines, so the app limits the coins it accepts, says why, and asks the patient to pay the rest by card or cash.
  - **At the pharmacy counter:** the patient taps **My coins → Pay at a pharmacy counter** and gives the pharmacist a one-time code (valid 10 minutes). Without the code nobody can spend their coins. Prescription-only items can't be paid with coins at the counter either.
  - Coins can't be used for donations or insurance premiums, or with escrow.
- **Who pays for used coins:** N-Health. The provider still earns their full share, so reward coins are a marketing cost.
  - Card: the gateway settles the provider's share of what the patient paid straight to their bank, and N-Health credits the coin part to their earnings balance. N-Health's commission and booking fee are unchanged.
  - Cash: the provider collects the reduced amount, and N-Health credits the coin part to their balance.
  - All coins: the provider's fee, less commission, is credited to their balance.
  - Credits are paid out on the payout schedule.
- **Value:** `COIN_VALUE_NGN` (default 10) is what N-Health pays a provider for each coin used. Patients see coin balances only.
- **Prices:** all prices are shown in naira, because patients pay providers in money (card or cash).

This follows the same model as other reward apps. For example, Muslim Pro's Stars and Crescents are earned through in-app activity, never bought, and redeemed only for in-app rewards or donations the company makes.

## Health quests
Patients earn coins for actions that are good for their health. The quest board is on **My coins** (Home → 🎯 Quests), and the server checks every quest before paying it.

| Quest | Coins (default) | How often |
|---|---|---|
| Daily check-in (button on the home card; builds a 🔥 streak) | 1 | every day |
| Read a health article for 20 seconds | 1 | every day |
| Complete health profile (blood group, genotype, emergency contact) | 5 | once |
| Confirm email | 2 | once |
| Confirm phone | 2 | once |
| Verify identity | 10 | once |
| Set a medication reminder | 2 | once |
| Record a vaccination | 2 | once |
| Have a check-up (a completed appointment) | 5 | once |
| Donate blood (each completed pledge) | 20 | each time |

- **Daily limit:** 20 coins a day from quests.
- **Admin control:** in Admin → Donation campaigns → Health quests, super admins change coins per quest (0 switches one off), change the daily limit, or pause all quests.
- **Providers** can earn the check-in, reading, email, phone and identity quests.
- **Cost:** each coin a patient later uses costs N-Health `COIN_VALUE_NGN` (₦10). For example, 10,000 patients checking in daily is 10,000 coins (₦100,000) a day if all of them are spent. Keep the daily limit and coin values within your marketing budget.

## Donating coins (like Muslim Pro's Crescents)
- When the partner NGO is switched on, patients can **Donate coins** from My coins.
- The coins are used up, and N-Health pays their value to the NGO from its own funds.
- Admin → Donation campaigns → **Coin donations to pay** shows the total owed to the NGO each month.
- Donating is final, as is using coins.

## Invite rewards
- **How invites work:** every user has an invite card on their home page (Share, WhatsApp, Copy). The link (`https://www.nhealth.com.ng/?ref=CODE`) opens sign-up with the code filled in. Provider flyers carry the provider's code too.
- **When the reward is paid:** the inviter earns **1 coin** (`INVITE_REWARD_COINS`) when the friend they invited **confirms their email or phone number**. Paying at confirmation stops fake sign-ups from farming coins. The coin is paid only once per friend.
- **What the inviter sees:** the card shows "Earn 1 coin for every friend who joins", followed by how many friends joined and how many coins were earned (`GET /api/invites/summary`).

## If you later partner with a licensed payments company
With a CBN-licensed partner holding the funds, coin sales can be switched back on with `COIN_TOPUP_ENABLED=true`. The old top-up screen and price display return. Don't switch it on without that partner and written legal advice.
