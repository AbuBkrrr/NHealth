# WhatsApp set-up (N-Health sends no SMS)

N-Health reaches people in the app (with push notifications), by email, and on WhatsApp. WhatsApp carries:
- verification codes (phone check, password reset);
- urgent alerts (emergency, hospital ready, ambulance on the way, pharmacy order ready);
- appointment reminders and job updates;
- news, only to people who opted in.

**If WhatsApp isn't set up yet, or a number isn't on WhatsApp:**
- verification codes go to the account's email;
- alerts still arrive in the app and as push notifications;
- in an emergency, the app shows the patient a **Message my emergency contact on WhatsApp** button, which sends from their own phone.

## 1. Create the WhatsApp Business account (about 30 minutes)
1. Go to **business.facebook.com** and create a Meta Business account for your company (use your CAC details).
2. In **developers.facebook.com**, create an app of type **Business**, then add the **WhatsApp** product.
3. Under **WhatsApp → API Setup**, add your business phone number and verify it. Use a number that isn't already registered in the WhatsApp app.
4. Copy the **Phone number ID**. This is `WHATSAPP_PHONE_NUMBER_ID`.
5. Create a permanent token:
   1. **Business settings → Users → System users → Add**, with role Admin.
   2. **Assign assets:** your app, with full control.
   3. **Generate token** with the permissions `whatsapp_business_messaging` and `whatsapp_business_management`.

   This token is `WHATSAPP_TOKEN`. Keep it secret.
6. **Business settings → Security centre → Start verification** (business verification). This raises your sending limits.

## 2. Get the three message templates approved
In **WhatsApp Manager → Message templates → Create template**, create these. The names must match exactly.

| Name | Category | Body | Buttons |
|---|---|---|---|
| `nhealth_code` | Authentication | (Meta's fixed text) `{{1}} is your verification code.` with "Add security recommendation" ticked and code expiry 10 minutes | **Copy code** |
| `nhealth_update` | Utility | `N-Health: {{1}}` | none |
| `nhealth_news` | Marketing | `{{1}}` | Quick reply: **Stop promotions** |

Language: English (`en`). Approval usually takes minutes to a few hours.

## 3. Add the keys to the server
In `/opt/nhealth/backend.env` (VPS), or your backend environment:
```
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
```
Then run `nhealth-update` (or restart the API).

**✔ Check:**
1. Open Admin → Integration status. **WhatsApp Business** should show your number and quality rating.
2. Enter your phone under **Send a test** and press **Test WhatsApp**. The message should arrive.

## Costs and rules
- Meta charges per message by category. Authentication and utility messages are cheap; marketing costs more. Replies to a customer within 24 hours of their last message are free.
- Send marketing only to people who ticked "marketing messages" (the broadcast tool does this automatically). People can tap **Stop promotions**.
- Keep message quality high: Meta lowers your limits if many people block the number.
