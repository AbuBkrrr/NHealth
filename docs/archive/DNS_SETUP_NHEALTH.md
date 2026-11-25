# DNS Configuration for Nhealth.com.ng

## Quick Reference

Add these DNS records at your DNS provider's control panel:

---

## Primary Records (Required)

### 1. Backend API: api.nhealth.com.ng

```
Type:  CNAME
Name:  api
Value: <Render CNAME from backend service>
TTL:   3600
```

**Where to find Render CNAME:**
1. Render Dashboard → **n-health-backend** → **Settings**
2. Look for **Custom Domains** section
3. Copy the CNAME target value

---

### 2. Admin Panel: admin.nhealth.com.ng

```
Type:  CNAME
Name:  admin
Value: <Render CNAME from admin-web service>
TTL:   3600
```

**Where to find Render CNAME:**
1. Render Dashboard → **n-health-admin-web** → **Settings**
2. Look for **Custom Domains** section
3. Copy the CNAME target value

---

## Email Records (For SendGrid)

### 3. SendGrid Sender Verification: noreply.nhealth.com.ng

Once you create a SendGrid account and add `noreply@nhealth.com.ng` as a sender:

**SendGrid will provide TXT and/or CNAME records. Add them:**

```
Type:  TXT or CNAME (as provided by SendGrid)
Name:  <as provided by SendGrid>
Value: <as provided by SendGrid>
TTL:   3600
```

**Note:** You'll see these instructions in SendGrid dashboard after clicking "Verify Domain". This step is optional but recommended for email deliverability.

---

## Root Domain (Optional)

### 4. Root Domain: nhealth.com.ng (Optional)

For your root domain, you have options:

**Option A: Redirect to admin panel**
```
Type:  CNAME or ALIAS
Name:  @ (or leave blank)
Value: admin.nhealth.com.ng
TTL:   3600
```

**Option B: Redirect to a landing page**
```
(Set up after creating a landing page/website)
```

**Option C: Leave as-is**
```
(Some DNS providers require an A record pointing to your server)
```

---

## Step-by-Step: Add Records at Your Provider

### If using **GoDaddy**:
1. Log in → **Manage Domains** → Select **nhealth.com.ng**
2. Click **DNS** → **Manage DNS**
3. For each record above:
   - Click **Add** 
   - Type: Select **CNAME** (or **TXT** for SendGrid)
   - Name: Enter the subdomain (e.g., `api`, `admin`)
   - Value: Paste the target value
   - Click **Save**

### If using **Namecheap**:
1. Log in → **Dashboard** → Select **nhealth.com.ng**
2. Click **Manage** → **Advanced DNS**
3. For each record:
   - Click **Add New Record**
   - Type: **CNAME** (or **TXT** for SendGrid)
   - Host: Enter subdomain (e.g., `api`, `admin`)
   - Value: Paste target
   - TTL: `3600` or default
   - Click ✅

### If using **Cloudflare**:
1. Log in → **Websites** → Select **nhealth.com.ng**
2. DNS → **DNS Records**
3. For each record:
   - Click **+ Add Record**
   - Type: **CNAME** (or **TXT**)
   - Name: `api`, `admin`, etc.
   - Content: Paste target
   - TTL: `3600` or **Auto**
   - Click **Save**

---

## Verify DNS Propagation

After adding records (wait 5-10 minutes), test:

```bash
# Check api subdomain
nslookup api.nhealth.com.ng
# Should show the Render CNAME

# Check admin subdomain
nslookup admin.nhealth.com.ng
# Should show the Render CNAME

# Verify HTTPS works
curl https://api.nhealth.com.ng/health
# Should return: {"status":"ok"}

curl https://admin.nhealth.com.ng
# Should load the admin panel
```

---

## Troubleshooting DNS

| Issue | Solution |
|-------|----------|
| "NXDOMAIN" or "not found" | Wait 10-15 min for propagation; check provider dashboard for typos |
| "Connection refused" | Verify you copied the correct Render CNAME value |
| "Certificate error" (HTTPS) | Render auto-generates certs; wait 5 min after setting custom domain |
| `nslookup` shows old value | Flush DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac) |

---

## SSL/TLS Certificates

✅ **Automatic** — Render auto-provisions Let's Encrypt certificates for both subdomains once DNS is configured.

- No action needed
- Auto-renewal every 60 days
- Covers both `api.nhealth.com.ng` and `admin.nhealth.com.ng`

---

## SendGrid Email Setup (If Needed)

After DNS records are added:

1. Create SendGrid account: [sendgrid.com](https://sendgrid.com)
2. Verify sender domain: `noreply@nhealth.com.ng`
3. SendGrid provides TXT/CNAME records → add them to your DNS
4. Get API key from SendGrid dashboard
5. Add to Render backend environment:
   ```
   SENDGRID_API_KEY=<your-key>
   SENDGRID_FROM_EMAIL=noreply@nhealth.com.ng
   ```

---

## Summary Checklist

- [ ] Add `api.nhealth.com.ng` CNAME record
- [ ] Add `admin.nhealth.com.ng` CNAME record
- [ ] Wait 5-10 minutes for DNS propagation
- [ ] Test `curl https://api.nhealth.com.ng/health`
- [ ] Test `https://admin.nhealth.com.ng` in browser
- [ ] (Optional) Add SendGrid TXT/CNAME records
- [ ] (Optional) Configure root domain redirect

✅ **All done!** Your deployment is live.

---

**Questions?** See `DEPLOYMENT_GUIDE_NHEALTH.md` for full deployment walkthrough.
