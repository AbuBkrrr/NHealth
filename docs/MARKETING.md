# Marketing (super admin)

Admin console → **Marketing**. Only super admins see it.

## 1. Make a tracking link or QR code per place you advertise

**Links, QR & share kit → New tracking link.** Make one link for each flyer batch, influencer, WhatsApp group, radio ad or partner. Then you can see which one brings sign-ups.

| Field | What it does |
|---|---|
| Channel | qr, whatsapp, instagram, facebook, tiktok, x, linkedin, email, sms, flyer, radio, partner… |
| Audience | Everyone, Patients, Health providers or Hospitals & clinics. The pitch page adapts to it. |
| Opens | **Pitch page**, or **Straight to sign-up** |

Each link gets:
- **An address:** `https://www.nhealth.com.ng/go/<name>`
- **QR codes:** a PNG to print, or an SVG for designers
- **One-click share buttons:** WhatsApp, Facebook, X, LinkedIn, Telegram, email and SMS. Each comes with a ready-made message in English, French, Spanish, Portuguese, Arabic or Swahili.

## 2. Same device or shared?

The **Overview** shows, for each link:
- the number of opens
- the number of **different devices**
- the number of **repeat opens (same device)**
- a verdict: `1 device, opened 3×` or `Shared · 2 devices`

The **Recent opens** tab lists every open with:
- **Device:** a number per link (#1, #2…), with "New device" or "Same device · open #3"
- **Phone:** model, operating system and browser
- **App:** whether it was opened inside WhatsApp, Instagram, Facebook, TikTok and so on
- **Location:** city, region and country
- **Language and timezone**
- **Sign-up:** whether that device later signed up

Leads and sign-ups are credited to the link the device first came from.

**How devices are told apart.** The pitch page keeps a random ID in the visitor's browser. It contains no personal data. A link forwarded to another phone arrives with a different ID. If the browser blocks storage, the page falls back to a rough signature (phone model, screen, timezone, language), which can't tell identical phones apart.

Treat "Shared" as a strong hint, not proof. The same person shows up as a new device if they:
- use a private window
- clear their browser data
- switch browsers, for example from WhatsApp's built-in browser to Chrome

**Precise location.** The pitch page shows a "Find verified care near you · Allow" card, and asks again when the visitor taps sign-up. If they allow it, the phone's GPS position is saved with that open, along with the accuracy the phone reports. Recent opens shows it as 📍 coordinates with a map link and "±8 m", green when within 10 m, and the Overview counts how many opens have a precise location and how many of those are within 10 m.

Browsers only share GPS after the visitor taps "Allow", and privacy law requires that consent. Phones are usually accurate to 5–20 m outdoors and less precise indoors.

**City-level location** comes from Cloudflare's visitor-location headers when Cloudflare's proxy is on. Otherwise it comes from a city-level IP lookup; set `GEOIP_LOOKUP=off` in `backend.env` to disable that. IP addresses are stored only as a one-way hash.

## 3. Leads

The pitch page has a **Talk to our team** form. In the **Leads** tab, each lead shows:
- interest, organisation and location
- **how many times that device opened the page before filling the form**
- whether they agreed to be contacted

You can mark a lead NEW, CONTACTED, REGISTERED or LOST, or export all leads to CSV. When a lead signs up with the same email, they are marked REGISTERED automatically.

## 4. Broadcast (email & SMS)

**Broadcast** sends a campaign by email (Resend) or SMS (Termii). It goes only to people who agreed:
- users who ticked "health tips and product updates"
- leads who ticked consent and haven't signed up yet

You can filter by role, country and lead interest. Use `{{name}}` and `{{link}}` in the message; `{{link}}` becomes a tracking link, so the opens show up in Marketing. Every email has a one-click unsubscribe link, and SMS messages end with "Reply STOP". **Count recipients** shows how many people will receive it before you send.

## 5. Ads & page settings

- **Pitch page:** the headline, the sub-headline, and the WhatsApp number for the "WhatsApp" button.
- **Ad pixels:** your Meta (Facebook/Instagram) Pixel ID, Google tag (GA4 or Ads) and TikTok Pixel ID.
  - Visitors see a consent bar, and the pixels load only if they accept.
  - Sign-ups are reported to the ad platforms as `CompleteRegistration`, and lead forms as `Lead`.
  - With that, you can retarget visitors and optimise ads for sign-ups.

## Ideas to reach more people

- **Print and outdoor:** put a different QR code on each flyer batch, clinic poster and vehicle sticker, then compare which locations convert.
- **Sharing:** give every influencer, community leader and partner hospital their own link.
- **Timing:** check "Best hours to post or advertise" and "Opened inside app" before scheduling posts.
- **Ads:** run Meta or TikTok ads to a provider-audience link, optimised for the `CompleteRegistration` event.
- **Referrals:** users already have personal referral codes, and the top referrers appear on the Overview.
