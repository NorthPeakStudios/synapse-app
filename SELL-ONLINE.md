# Selling Synapse Pro online (website)

This covers selling Synapse Pro from the website version of Synapse (https://odin-cards.sites.tab.bot/).
The Google Play version has its own billing through Google Play. That's in CHECKLIST.md, and nothing here changes it.

**Right now web selling is OFF.** The website is fully unlocked for everyone, Odin's own copy included.
Nothing locks until someone turns it on on purpose (see "Turning it on").

There are two ways to sell, and both are already built:

| | A. Apple Cash (built, the one Odin picked) | B. Checkout from a seller service (built, needs an adult's account) |
|---|---|---|
| Who gets paid | Odin's Apple Cash (Apple Cash Family, managed by a parent) | A seller account in an adult's name, paid out to their bank |
| Automatic? | No. Odin sends each buyer a payment request by hand, then a code | Yes. Buyer pays at checkout and gets a license key by email |
| What's sold | Synapse Pro, $35 one time, lifetime | The same: $35 one time, lifetime |
| Sales tax | Not handled | Handled by the seller service (it is the "merchant of record") |
| Fees | None from Apple for personal Apple Cash payments | The service's fee per sale (check their own pricing page) |

---

## A. Apple Cash (manual)

### How it works for a buyer
1. In the web app: **Settings → Synapse Pro** (or tap anything with a lock).
2. The paywall says **Synapse Pro — $35 one time. Yours forever.** They tap **Pay with Apple Cash**. There's only one product: a lifetime unlock, no subscriptions or passes.
3. A short form asks for a **name or nickname** and the **phone number or email their Apple Cash uses**. It's sent to the app's own server and stored in its database (never shown publicly).
4. They see: "We'll send you an Apple Cash request within 24h. After you pay, you'll get an unlock code." The "Why Apple Cash?" explanation is shown on the paywall and again here.
5. Odin sends them an Apple Cash **request** from his own iPhone (Messages → Apple Cash → Request). His number or email is never shown on the site.
6. When it's paid, Odin opens his **owner page** and taps **Paid ✓ make code**. He gets a code like `SYN-7KQ2-M9XD` and a button that opens a text or email to the buyer with the code.
7. The buyer enters it under **Settings → Synapse Pro → Have an unlock code?** and Pro unlocks on that device.
   - Each code works on one device and never expires.
   - The app re-checks the code now and then. A revoked code turns Pro off at the next check.

### The owner page
- Address: `https://odin-cards.sites.tab.bot/admin-pro/#<owner token>`. Tab has the full private link (the token is saved on Tab's computer, not in the app's files). Ask Tab for it and keep it private, like a password.
- It isn't linked from anywhere and search engines are told to ignore it. Without the token it shows nothing.
- What it can do:
  - **Accept new requests** on/off. When it's off, the form says purchases aren't open.
  - New requests: copy the buyer's contact, **Paid ✓ make code**, or **Dismiss**.
  - **Make a code without a request**, for gifts or giveaways.
  - Done list: copy or send the code again, **Allow a new device** (when a buyer gets a new phone), **Revoke**, and **Delete their details**.
- Privacy: unpaid and dismissed requests are deleted automatically after 30 days. The privacy page (odin-cards.sites.tab.bot/privacy/) already says what the form collects.

### Turning it on
1. In `feat/pro/pro-config.js` (web app source), change `web: { enabled: false` to `enabled: true` and republish. Tab can do this in one step.
2. **Before or right after** that, unlock Odin's own copies so they never lock. On each of his devices, open the web app, go to **Settings → Synapse Pro → Have an unlock code?** and paste the owner link (or just the token).
   - Safari and the home-screen app keep separate storage on iPhone, so do it in each one.
   - Opening the owner page in Safari also unlocks Safari.
3. Open the owner page and switch **Accept new requests** on.
4. Optional: publish the "Buy Synapse Pro" section on the studio site (draft: `northpeak-site/drafts/buy-synapse-pro.html`, preview at `drafts/synapse-buy-preview/`). Tab has NOT pushed it.

To turn it off again: switch **Accept new requests** off (instant). To remove the paywall completely, set `enabled: false` and republish. Codes people already got keep working.

### How to test (before telling anyone)
1. Turn it on as above. Then, in a private Safari tab (so you're not the owner there), open the web app and check that locks appear.
2. Send a request with your own details. It should show up on the owner page within a few seconds.
3. Tap **Paid ✓ make code**, then enter the code in the private tab. Pro should unlock and the locks should disappear.
4. On the owner page, **Revoke** that test code.

### Important: the Apple Cash rules (an adult should read this)
- **Under 18:** Apple Cash for someone under 18 is **Apple Cash Family**, set up by a parent (the Family Sharing organizer). The parent can see the activity and limit who the account can send to or receive from. Check those settings so the buyers' payments can arrive.
- **Personal payments:** Apple Cash is meant for **personal payments between people**, not running a business. Apple's terms let them limit, suspend or close an account used that way. A handful of sales is unlikely to be noticed, but steady business use is a real risk. If sales grow, switch to option B. Read Apple's current Apple Cash terms; they're Apple's to change.
- **No buyer protection:** there are no chargebacks or automatic refunds. Decide a simple refund rule (for example, "email us within 7 days for a refund"), refund through Apple Cash, then **Revoke** the code.
- **Money and tax:** money earned is still income. A parent should keep track of it and check with a tax professional whether it needs reporting.
- **Safety:** only exchange Apple Cash with buyers through the request. Never share Odin's personal details beyond what Apple Cash shows. Don't meet buyers or move to other apps.
- **Google Play:** the Play Store version must not mention or link to Apple Cash or the website purchase. The code already keeps web selling out of the Play build (it only runs on the plain website).

---

## B. Checkout from a seller service (automatic, needs an adult)

This is the "real store" option. A service like Lemon Squeezy, Paddle or Gumroad acts as the **merchant of record**: it charges the card, handles sales tax and VAT, and pays out to a bank.

### What a parent (18+) must set up
1. **A seller account in the parent's own name**: their legal name, ID verification and contact details. (A 14-year-old can't hold one.)
2. **Payouts** to the parent's bank account (or PayPal), plus the tax form the service asks for (in the US, a W-9).
3. **Tax**: the service collects and pays sales tax/VAT on each sale because it's the merchant of record. Income tax on the payouts is still the parent's to handle.
4. **Fees**: check the service's own pricing page before choosing. Fees change and differ for subscriptions, international cards and payouts.
5. Create one product, **Synapse Pro**: **$35, one-time payment**, with **license keys turned on** and no expiry. Don't add subscriptions.

### Wiring it in (Tab can do this part)
1. In `feat/pro/pro-config.js`:
   - set `web.enabled: true` and `web.method: 'checkout'`;
   - under `web.checkout.products`, replace `url` with the product's **checkout link** and `productId` with its **product ID** from the dashboard.
   - **No API keys or secrets go in this file** (it ships to every phone); none are needed.
2. Tell the server the store and product IDs (owner token required):
   ```
   curl -X POST https://odin-cards.sites.tab.bot/api/pro/admin/license-config \
     -H "x-pro-admin: <owner token>" -H "content-type: application/json" \
     -d '{"ls_store_id":"12345","ls_products":{"111":"web_lifetime"}}'
   ```
   Until this is set, `/api/pro/license` answers `not_configured` and no key unlocks anything.
3. Republish. Buyers tap **Buy for $35**, pay in the checkout page, get a license key by email, and paste it under **Have a license key?**

### How to test option B
- Use the service's **test mode** with its test card numbers, buy Synapse Pro, paste the key and confirm Pro unlocks.
- Refund the test order and disable its key in the dashboard, then confirm it stops working at the next check.
- Not verified yet: the license check is written against Lemon Squeezy's public license-validation API, but it has never been run against a real store. Test it in test mode before going live.

---

## Where things are
- Prices, products, all the wording (including the "Why Apple Cash?" text) and the on/off switch: `feat/pro/pro-config.js`.
- Paywall, form and code screens: `feat/pro/pro.js`, `feat/pro/pro.css`.
- Server: `worker.js` → `proApi`. D1 tables: `pro_requests`, `pro_codes`, `pro_cfg`, `pro_hits`.
  - Endpoints: `/api/pro/status`, `/request`, `/redeem`, `/verify`, `/license`, `/admin/*`.
  - Rate limits: 3 requests per hour per connection (6 a day, 150 a day for everyone), 10 code tries per hour, 60 re-checks per hour.
- Prices: Synapse Pro is one product, a $35 one-time lifetime unlock, on the website (`web_lifetime`) and on Google Play (`synapse_pro_lifetime`).
- Owner page: `admin-pro/index.html`, `admin.js`, `admin.css` (not in the phone apps).


## Status (Oct 18, 2026, 7:15 PM PT)
- Web sale is ON (pro-config.js web.enabled: true, method applecash), live as SW cache cards-v106. The server accepts requests ("open" on).
- In web-sale mode the Deck Library is free and lists only decks we may sell (none yet), so it is not sold as part of Pro. An owner's-copy device lists every deck.
- Owner's copy: open the private owner page link once on each of Odin's devices, or enter the owner unlock code (an "owner" kind code marks the device as the owner's copy). Both are kept outside the app's files.
- Buy requests: see /home/user/tab/files/synapse-requests-api.txt for polling them.


## Update Oct 19, 2026 (v107): $35, 3-day trial, accounts
- Price is now **$35 one time** (lifetime). The website has **no free tier**: a new person gets a **3-day free trial** of everything, then the whole app shows the paywall (Pay with Apple Cash / Have an unlock code? / Sign in) until they pay, redeem a code, or sign in to a paid account. Switch: `web.trialDays` in feat/pro/pro-config.js (0 = old free tier).
- The trial is tied to the **account** when signed in (start date stored server-side in D1 at sign-up), or to the device (localStorage + a server record of the device ID) when signed out.
- The Apple Cash request form takes a **phone number only** (the server rejects anything else).
- **Accounts** (optional): email + password. Progress syncs; a code redeemed while signed in attaches Pro to the account; owner devices make the signed-in account the owner account. The owner page (/admin-pro/) has an **Accounts** section: give Pro / make owner by email (works before sign-up too), remove Pro, make a one-time password reset code, delete an account.
- Owner devices and owner/paid accounts are never locked.
