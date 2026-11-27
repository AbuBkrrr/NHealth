# Coins and invite rewards

## Coins
- **What patients see:** every price and balance in N-Health is shown in coins. **1 coin = ₦10** by default; the `COIN_VALUE_NGN` setting changes this.
- **What stays in naira:** inside the app all amounts are kept in naira, so provider fees, payouts, commissions and reports did not change. Providers are paid in naira to their bank and see naira.
- **Buying coins:** the person picks a number of coins. The naira price is shown before they pay ("500 coins – you pay ₦5,000"), and card and cash options show the naira amount charged. Buyers must see the real price of what they are paying for.
- **The rules shown to users:** coins can only be spent on N-Health services and products. They cannot be withdrawn, transferred to another person, or exchanged for cash.
- **Salaries in Health jobs:** these are real wages paid by employers outside the app, so they are stated in naira.

## Invite rewards
- **How invites work:** every user has an invite card on their home page (Share, WhatsApp, Copy). The link (`https://www.nhealth.com.ng/?ref=CODE`) opens sign-up with the code filled in.
- **When the reward is paid:** the inviter earns **1 coin** (`INVITE_REWARD_COINS`) when the friend they invited **confirms their email or phone number**. Paying at confirmation stops fake sign-ups from farming coins. The coin is paid only once per friend.
- **What the inviter sees:** the card shows "Earn 1 coin for every friend who joins", followed by how many friends joined and how many coins were earned (`GET /api/invites/summary`).
- **Who pays for reward coins:** the platform does. When a patient spends reward coins on a service, the provider is still paid in full, so reward coins are a marketing cost.
- **Change from before:** this replaces the old reward of 500 (naira-equivalent) on the friend's first top-up.
