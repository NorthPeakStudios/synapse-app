# Publishing Synapse: checklist for the adult account holder

Synapse is ready to build. What's left needs an adult (18+), because Google requires the developer account and the payments profile to belong to an adult. Odin can do the GitHub side himself (see GITHUB.md).

## Google Play (do this first)

### Costs and money
- **Developer account:** $25, paid once, by the adult on their own card.
- **Google's fee on sales:** 15% of every Synapse Pro purchase (Google's rate for a developer's first $1M a year). The rest is paid out monthly.
- **Payouts:** need a **payments (merchant) profile owned by the same adult**, with their bank account and tax details (US: a W-9). Google only pays out to an 18+ account holder with a bank account. Odin cannot own this part.
- Heads-up: an account that sells in-app items has to show a contact address on the store listing. Use an address the family is comfortable making public.

### 1. Create the developer account (adult, about 20 minutes plus verification)
1. Go to https://play.google.com/console/signup with the adult's Google account.
2. Choose a **Personal** account. A Business account needs a registered company with a D-U-N-S number; Personal is fine for now.
3. Developer name: **Northpeak Studios**. Contact email: **northpeak.support@gmail.com**. Website: https://northpeakstudios.github.io/
4. Pay the $25, then verify identity (ID document) and the phone number. Approval can take a few days.
5. **Setup -> Payments profile:** create the merchant profile in the adult's name, then add the bank account and tax info.

### 2. Create the app in Play Console
1. **Create app** -> name **Synapse: Med & Study Cards**, default language English (US), **App**, **Free** (it's free to download; Pro is an in-app purchase). Accept the declarations.
2. The package name is fixed by the first upload: **com.northpeakstudios.synapse**.
3. **Store presence -> Main store listing:** paste from `store/google-play/listing.txt`. Upload `icon-512.png`, `feature-graphic-1024x500.png` and the 6 phone screenshots (in order).
4. **Policy -> App content:** fill in each section from `store/google-play/content-rating.md` and `store/google-play/data-safety.md`:
   - privacy policy URL: https://northpeakstudios.github.io/synapse/privacy/
   - ads: none
   - target audience: 13 and up
   - content rating questionnaire, **declaring in-app purchases**
   - data safety (it covers in-app purchases too)
   - health apps declaration: medical reference and education
   - government app: no

### 3. Build and upload the first version
1. On GitHub (GITHUB.md): run **Make upload key (run once)** and add the two secrets, then run **Android (Google Play)** with *store* ticked and version name `1.0.0`.
2. Download the artifact. Upload the **.aab** in Play Console under **Test and release -> Testing -> Closed testing** -> create a track -> Create release. Accept **Play App Signing** when asked.

### 4. The Synapse Pro product (needs the payments profile and an uploaded build)
Synapse Pro is ONE product: a one-time lifetime unlock for $35. No subscriptions, no trial.
Create it in **Monetize with Play -> Products -> One-time products** with exactly this ID (it must match `feat/pro/pro-config.js`):

| Where | Product ID | Type | Price |
|---|---|---|---|
| One-time products | `synapse_pro_lifetime` | non-consumable (bought once, kept forever) | $35.00 |

Activate it. Prices for other countries can use Google's automatic conversion. Don't create any subscription products.

### 5. Test purchases for free
1. **Settings -> License testing:** add the Google accounts of Odin and the testers. Their purchases are test purchases and nobody is charged.
2. Install from the closed-test opt-in link, open Settings -> Synapse Pro, buy Synapse Pro, then try **Restore purchases** after reinstalling.

### 6. The required closed test (new personal accounts)
Google requires new personal developer accounts to run a **closed test with at least 12 testers who stay opted in for 14 days in a row** before they can apply for production.
1. Closed testing -> your track -> **Testers:** add a Google Group or an email list with 12 or more people (friends, family, classmates). Each one must:
   - open the opt-in link
   - tap "Become a tester"
   - install Synapse from Google Play
   - keep it installed for the whole 14 days
2. Ship a small update or two during the test, and read the feedback (Settings -> Help -> Send feedback arrives through Tab).
3. After 14 days: **Dashboard -> Apply for production access**, then answer Google's questions about the test. Review usually takes up to 7 days.
4. Then **Production -> Create release** with the same .aab or a newer one, and roll out.

### 7. After launch
- Web and content changes reach installed apps by live update (BUILD.md). Native changes need a new build from the workflow; the version code goes up automatically.
- Refunds happen in Google Play. Support email: northpeak.support@gmail.com.

## Apple (second option, later)
- The Apple Developer Program costs $99 a year and also needs an adult account holder. Not needed now: Odin installs the iPhone build himself with SIDELOAD.md.
- If you go to the App Store later, the paywall would need Apple in-app purchases set up the same way (the billing plugin supports StoreKit 2). That would be a separate step.
