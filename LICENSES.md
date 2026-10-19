# Third-party content in Synapse, and whether it is OK in a paid store app

The full list (147 items, with author, licence and source link) is in the app under **Settings -> About -> Credits & licenses**. It is generated from `feat/about/credits.json` on the website. Summary by licence:

| Group | Licence | Items | OK in a paid app? |
|---|---|---|---|
| 3D anatomy | CC BY-SA 2.1 Japan | 1 | Yes, with attribution (already shown in Credits) |
| CT & MRI images | CC BY 4.0 | 2 | Yes, with attribution (already shown in Credits) |
| CT & MRI images | CC BY-SA 3.0 | 9 | Yes, with attribution (already shown in Credits) |
| CT & MRI images | CC BY-SA 4.0 | 6 | Yes, with attribution (already shown in Credits) |
| CT & MRI images | CC0 | 2 | Yes |
| CT & MRI images | Public domain | 2 | Yes |
| Deck Library | Shared on AnkiWeb, no licence stated (one deck links a source repo) | 28 | NO LICENCE: kept out of the store build |
| Fonts & icons | ISC (Lucide) | 1 | Yes |
| Fonts & icons | No fonts are bundled | 1 | Yes |
| Heart & lung sounds | CC BY-SA 3.0 | 9 | Yes, with attribution (already shown in Credits) |
| Heart & lung sounds | CC BY-SA 4.0 | 8 | Yes, with attribution (already shown in Credits) |
| Heart & lung sounds | CC0 | 2 | Yes |
| Libraries | Apache 2.0 | 2 | Yes |
| Libraries | MIT | 5 | Yes |
| Libraries | MIT (dual MIT / GPLv3, used under MIT) | 1 | Yes |
| Look-ups | CC BY-SA 4.0 | 2 | Yes, with attribution (already shown in Credits) |
| Look-ups | Varies (open licences) | 1 | Yes (open licences, attributed) |
| Medical photos | CC BY 2.0 | 1 | Yes, with attribution (already shown in Credits) |
| Medical photos | CC BY 3.0 | 4 | Yes, with attribution (already shown in Credits) |
| Medical photos | CC BY 4.0 | 1 | Yes, with attribution (already shown in Credits) |
| Medical photos | CC BY-SA 2.0 | 4 | Yes, with attribution (already shown in Credits) |
| Medical photos | CC BY-SA 2.5 | 1 | Yes, with attribution (already shown in Credits) |
| Medical photos | CC BY-SA 3.0 | 23 | Yes, with attribution (already shown in Credits) |
| Medical photos | CC BY-SA 4.0 | 12 | Yes, with attribution (already shown in Credits) |
| Medical photos | CC0 | 13 | Yes |
| Medical photos | Public domain | 6 | Yes |

## Flags
- **No NonCommercial (NC) or NoDerivatives (ND) licences** anywhere, so charging for Synapse Pro does not conflict with any credited asset.
- **CC BY-SA** items (sounds, scans, photos, BodyParts3D) may be used in a paid app. Keep the attribution in Credits, and keep any edited versions of those files under the same licence.
- **Deck Library:** All 28 decks were shared on AnkiWeb with no licence stated. The store build already hides every deck without an open licence (`native/boot.js`), which currently leaves the store Deck Library **empty**. It is gated as Pro but is not advertised on the paywall or in the listing. To offer it, add decks that carry an open licence (CC BY, CC BY-SA, CC0) or get written permission from each author.
- **Stockfish (GPL):** not included. Chess was removed from the app in v99 and the store build does not bundle `/chess/`.
- **Libraries:** MIT / Apache 2.0 / ISC. The billing plugin `@capgo/native-purchases` is MPL-2.0. That is fine for a closed app as long as its own files are not modified (they aren't).
- **Name use:** the app UI refers to the .apkg deck format by the name of the app that created it ("Anki decks"). That describes a file format and is generally fine. The Play listing avoids the name anyway.
