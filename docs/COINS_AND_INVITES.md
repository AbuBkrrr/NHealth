# Coins and invite rewards

## Coins are a free reward, like loyalty points
- **How people get coins:**
  - inviting friends (see below);
  - promotions an admin grants;
  - coins returned when a booking paid with coins is cancelled.
- **Coins are never sold.**
  - Buying coins is switched off (`COIN_TOPUP_ENABLED=false`), so the top-up screen is gone and the API refuses top-ups.
  - Selling coins for naira and letting people pay providers with them would be stored value, which needs a CBN licence or a licensed partner. See [COMPLIANCE_MODEL.md](COMPLIANCE_MODEL.md).
- **Coins can't be withdrawn, transferred to another person or exchanged for cash.** The terms of service say so, and the app enforces it.
- **Using coins:** when paying for a booking, pharmacy order, test or home-care visit, a patient with enough coins can choose **Use my reward coins**. Coins can't be used for donations or insurance premiums.
- **Who pays for used coins:** N-Health. The provider is paid in full for the part covered by coins (less the usual commission), credited to their N-Health earnings balance and paid out on the payout schedule. Reward coins are a marketing cost.
- **Value:** `COIN_VALUE_NGN` (default 10) is what N-Health pays a provider for each coin used. Patients see coin balances only.
- **Prices:** all prices are shown in naira, because patients pay providers in money (card or cash).

This follows the same model as other reward apps. For example, Muslim Pro's Stars and Crescents are earned through in-app activity, never bought, and redeemed only for in-app rewards or donations the company makes.

## Invite rewards
- **How invites work:** every user has an invite card on their home page (Share, WhatsApp, Copy). The link (`https://www.nhealth.com.ng/?ref=CODE`) opens sign-up with the code filled in. Provider flyers carry the provider's code too.
- **When the reward is paid:** the inviter earns **1 coin** (`INVITE_REWARD_COINS`) when the friend they invited **confirms their email or phone number**. Paying at confirmation stops fake sign-ups from farming coins. The coin is paid only once per friend.
- **What the inviter sees:** the card shows "Earn 1 coin for every friend who joins", followed by how many friends joined and how many coins were earned (`GET /api/invites/summary`).

## If you later partner with a licensed payments company
With a CBN-licensed partner holding the funds, coin sales can be switched back on with `COIN_TOPUP_ENABLED=true`. The old top-up screen and price display return. Don't switch it on without that partner and written legal advice.
