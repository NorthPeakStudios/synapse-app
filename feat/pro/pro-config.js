/* Synapse Pro: the ONE place for prices, product IDs, the free / Pro split, and the web-sale settings.
   Two ways the paywall can turn on, and both are OFF unless switched on on purpose:
   1) the Google Play build (native/config.js sets store: true when the app is built with
      `node scripts/fetch-web.mjs --store`) — billing through Google Play, products below;
   2) web-sale mode on the website: set web.enabled to true below and publish. Off by default,
      so the live website stays fully unlocked. See SELL-ONLINE.md in the app project.
   Sideload builds never lock anything. No keys or secrets belong in this file: it ships to every phone. */
window.SYNAPSE_PRO = {
  enabled: true,               // master switch for store builds; false = store build is fully unlocked too
  name: 'Synapse Pro',
  // ONE product: a one-time lifetime unlock. Play Console → Monetize → In-app products: synapse_pro_lifetime ($35.00, non-consumable)
  tagline: 'Synapse Pro \u2014 $35 one time. Yours forever.',
  products: [
    { id: 'synapse_pro_lifetime', type: 'inapp', label: 'Lifetime', price: '$35', per: 'once', best: true }
  ],
  links: {
    privacy: 'https://northpeakstudios.github.io/synapse/privacy/',
    terms: 'https://play.google.com/intl/en_us/about/play-terms/',
    manage: 'https://play.google.com/store/account/subscriptions?package=com.northpeakstudios.synapse'
  },
  // FREE in the store build: your own decks, studying (SRS), stats, Weak Spots, the daily challenge,
  // the daily Doctordle case, the first level of every course, and these Lab tools.
  free: {
    learnLevels: ['kid'],              // "Like I'm 5" level of every course (lessons + tests)
    lab: ['doc', 'match', 'words', 'vit'] // Doctordle daily case + 3 Lab tools
  },
  // PRO: everything in the Lab hub not listed above, plus these.
  pro: {
    features: ['anki', 'occl', 'themes', 'dle', 'anat', 'rx'],
    views: ['library', 'anat'],        // Deck Library, Anatomy 3D
    icons: true,                       // alternate app icons
    doctordleUnlimited: true           // "Random new case" / "Next case" beyond the daily case
  },
  /* ---------- web-sale mode (the website selling Pro itself) ---------- */
  web: {
    enabled: true,             // THE switch. false = the website is fully unlocked (Odin's own copy too). true = website sells Pro.
    trialDays: 3,              // web: no free tier. New people get a 3-day free trial of everything (tied to their account when signed in),
                               // then the whole app locks behind the paywall until they buy, redeem a code, or sign in to a paid account.
    method: 'applecash',       // 'applecash' = buyer sends a request, you send an Apple Cash request, then an unlock code
                               // 'checkout'  = hosted checkout from a merchant-of-record (needs an adult seller account; see SELL-ONLINE.md)
    // One product: a one-time lifetime unlock for $35 (codes are lifetime only).
    products: [
      { id: 'web_lifetime', label: 'Lifetime', price: '$35', per: 'once', note: 'Pay once, yours forever', best: true }
    ],
    copy: {
      why: 'Why Apple Cash? Synapse is built by an independent student developer. Paying through Apple Cash means your money goes straight to the person who made the app — no middleman, no store cut. It\u2019s not instant: after you send the form, you\u2019ll get an Apple Cash request for your plan ($35 or $100) on the phone number you entered (usually within a few hours, always within 24h). Pay it, and it unlocks on your account email right after, plus an unlock code.',
      cta: 'Pay with Apple Cash',
      formTitle: 'Request an Apple Cash payment',
      formNote: 'We only use your number to send the Apple Cash request and your unlock code, and your email to attach the purchase to your account.',
      sent: 'We\u2019ll text an Apple Cash request for {price} to your phone within 24h. After you pay, it unlocks on your account email, and you also get an unlock code.',
      fine: '$35 (Synapse) or $100 (all Northpeak apps) once, no subscription. Apple Cash works in the US on iPhone. Questions: northpeak.support@gmail.com',
      codeTitle: 'Have an unlock code?',
      codeNote: 'Enter the code you got after paying. It unlocks Synapse Pro on this device, and on your account if you\u2019re signed in.'
    },
    // 'checkout' method only: hosted checkout link + product ID from the merchant-of-record dashboard.
    // Placeholders: nothing here works until an adult seller account exists and these are replaced.
    checkout: {
      provider: 'lemonsqueezy',
      products: [
        { id: 'web_lifetime', label: 'Lifetime', price: '$35', per: 'once', best: true, url: 'https://YOUR-STORE.lemonsqueezy.com/buy/REPLACE-LIFETIME-VARIANT', productId: 'REPLACE_PRODUCT_ID' }
      ],
      keyTitle: 'Have a license key?',
      keyNote: 'Paste the license key from your receipt email.'
    },
    links: {
      privacy: 'https://odin-cards.sites.tab.bot/privacy/',
      terms: 'https://northpeakstudios.github.io/synapse/',
      contact: 'mailto:northpeak.support@gmail.com'
    }
  },
  benefits: [
    ['learn', 'All 200 courses at every level', 'High school to doctor level, with every test'],
    ['lab', 'The full Lab', 'Patient sims, ECG, CT and MRI, Anatomy 3D'],
    ['books', 'Deck import and image occlusion', 'Bring in .apkg decks, turn diagrams into cards'],
    ['steth', 'Unlimited Doctordle', 'New cases anytime, not just the daily one'],
    ['pill', 'Interactions game', 'Spot the drug interaction against the clock'],
    ['palette', 'Themes and app icons', 'Make it look the way you like']
  ]
};
