# SendGrid Email Configuration Guide

## Overview

SendGrid sends transactional emails for:
- Payment confirmations
- Order status updates
- Appointment reminders
- Admin notifications

**Free tier**: 100 emails/day (sufficient for MVP)

---

## Step 1: Create SendGrid Account

1. Go to [sendgrid.com](https://sendgrid.com)
2. Click **Sign Up** (use a business email)
3. Complete verification
4. Log in to dashboard

---

## Step 2: Verify Sender Domain

Email must come from a verified domain (`noreply@nhealth.com.ng`).

### 2.1 Start Verification
1. SendGrid dashboard → **Settings** → **Sender Authentication**
2. Click **Authenticate Your Domain**
3. Enter domain: `nhealth.com.ng`
4. Choose subdomain prefix: `noreply` (so sender is `noreply@nhealth.com.ng`)
5. Click **Next**

### 2.2 Add DNS Records

SendGrid provides **2-3 DNS records** to add (usually CNAME):

Example:
```
Type:  CNAME
Name:  s1._domainkey.noreply.nhealth.com.ng
Value: s1.domainkey.sendgrid.net
TTL:   3600
```

**Add ALL records provided by SendGrid to your DNS provider** (same place you added `api` and `admin` subdomains).

### 2.3 Wait for Verification

Click **Verify** in SendGrid → wait 5-10 minutes for DNS to propagate.

Once verified, you'll see a ✅ checkmark.

---

## Step 3: Create API Key

### 3.1 Generate Key
1. SendGrid dashboard → **Settings** → **API Keys**
2. Click **Create API Key**
3. Name: `N-Health Backend Production`
4. Access Level: **Full Access**
5. Click **Create & View**
6. **Copy the entire key** (you'll only see it once!)

Example format:
```
SG.aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890
```

---

## Step 4: Add API Key to Render

### 4.1 Update Backend Environment
1. Render Dashboard → **n-health-backend** → **Environment**
2. Add new variable:
   ```
   SENDGRID_API_KEY=SG.aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890
   ```
3. Add another:
   ```
   SENDGRID_FROM_EMAIL=noreply@nhealth.com.ng
   ```
4. Click **Save**
5. Click **Manual Deploy** → **Deploy latest commit**

**Wait for deployment to complete** (watch logs for `Listening on port 4000`).

---

## Step 5: Test Email Sending

### 5.1 Backend Test Endpoint (Optional)

If your backend has a test endpoint, call:
```bash
curl -X POST https://api.nhealth.com.ng/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com"}'
```

Check your inbox for test email.

### 5.2 Manual Test via SendGrid

1. SendGrid dashboard → **Mail Send** → **Test Your Integration**
2. Send test email
3. Verify it arrives in inbox

---

## Step 6: Monitor Email Sending

### 6.1 Check Delivery
1. SendGrid dashboard → **Email Activity**
2. Filter by date/status
3. Verify emails show **Delivered** ✅

### 6.2 Check Bounce Rate
1. SendGrid dashboard → **Suppressions** → **Bounces**
2. Monitor invalid email addresses
3. Consider adding a bounce handler to clean up invalid emails

---

## Email Configuration in Backend

Your backend code should send emails like this:

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'patient@gmail.com',
  from: process.env.SENDGRID_FROM_EMAIL, // noreply@nhealth.com.ng
  subject: 'Payment Confirmation',
  html: '<p>Your payment has been confirmed.</p>',
};

await sgMail.send(msg);
```

---

## Email Templates (Advanced)

For better-looking emails, create templates in SendGrid:

1. SendGrid dashboard → **Email API** → **Dynamic Templates**
2. Click **Create Template**
3. Name: `payment-confirmation`, `order-status`, etc.
4. Design in the editor
5. Use template ID in backend:

```typescript
const msg = {
  to: 'patient@gmail.com',
  from: process.env.SENDGRID_FROM_EMAIL,
  templateId: 'd-abc123def456',
  dynamicTemplateData: {
    amount: '₦5,000',
    orderNumber: 'ORD-12345',
  },
};

await sgMail.send(msg);
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid API key" | Verify key is correct in Render environment; redeploy |
| "Domain not verified" | Wait 10 min for DNS propagation; check all 3 CNAME records added |
| Emails not sent | Check SendGrid dashboard → Email Activity for error messages |
| Emails in spam | Use authenticated domain; SendGrid has good deliverability |
| "Insufficient quota" | You've sent 100 emails/day (free tier limit); upgrade plan |

---

## Upgrade Path (When Needed)

**Free tier limits:**
- 100 emails/day
- 5 campaigns
- No advanced analytics

**To upgrade:**
1. SendGrid dashboard → **Plan & Billing**
2. Choose paid plan ($14.95+/month)
3. Billing automatically updates

---

## Checklist

- [ ] Create SendGrid account
- [ ] Verify sender domain (`noreply@nhealth.com.ng`)
- [ ] Add DNS records from SendGrid to your provider
- [ ] Create API key
- [ ] Add `SENDGRID_API_KEY` to Render backend environment
- [ ] Add `SENDGRID_FROM_EMAIL=noreply@nhealth.com.ng` to Render
- [ ] Deploy backend
- [ ] Test sending an email
- [ ] Monitor email activity in SendGrid dashboard

✅ **Done!** Your email system is live.

---

## Next Steps

See:
- `DEPLOYMENT_GUIDE_NHEALTH.md` — full deployment walkthrough
- `DNS_SETUP_NHEALTH.md` — DNS record configuration
- `POST_DEPLOYMENT_CHECKLIST.md` — verification steps
