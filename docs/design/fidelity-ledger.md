# AskAgent fidelity review

## Current document-first presentation

The user explicitly replaced the marketing homepage with an English protocol document and a bottom “Test this scenario” section. This direction supersedes the earlier primary-screen concept below. The final purchase handoff retains its visual interface and carries the selected product, quote, card message and confirmation step.

The new page uses an 800 px document column, ordinary headings and HTTP examples, with no hero photography, shop rail, comparison playground or activity table on the homepage. At 390 × 844, the measured document and viewport widths both equal 390 px. The native-assistant dialog contains the complete scenario and the correct public Pages origin. The saved mobile document capture is `artifacts/screenshots/protocol-document-mobile.png`.

The live merchant handoff was verified separately: the saved card message, 25-stem requirement, 1,500 TRY budget and 20:00 deadline appeared with a 1,370 TRY quote. Explicit confirmation created a simulated order. Its production screenshot is `artifacts/screenshots/production-order.png`. Native ChatGPT comparison has been observed; full dynamic conversation remains a separate compatibility check.

## Earlier marketing concept verification

Reviewed on 12 October 2026. The primary concept and latest English browser render were opened together with `view_image`.

- Accepted concept: `docs/design/primary-screen.png`, native 1487 × 1058.
- Browser render: `artifacts/screenshots/desktop-home.png`, captured through the in-app browser at 1487 × 1058.
- Additional references already inspected: `docs/design/composer-activity.png` and `docs/design/merchant-handoff.png`.
- Responsive continuation was inspected at 390 × 844. Headline, actions, image, shop rail, and navigation fit without horizontal page overflow.

| Comparison | Concept evidence | Render evidence and decision |
| --- | --- | --- |
| Composition | Open 50/50 hero with approximately 52 px gutters; photo begins directly below navigation. | Shared gutters, split hero, photo height, and first shop divider retain the same composition. No enclosing cards were introduced. |
| Headline | Exactly two desktop lines: “Good things.” and “Delivered by agents.” | Both lines preserved. Bundled Inter, tight tracking, and approximately 78 px type reproduce the hierarchy. Copy positioning was moved down 24 px after initial review. |
| Supporting copy | One line below the headline. | Initial wrapping was repaired by allowing the complete column width. The final sentence occupies one desktop line and wraps naturally on mobile. |
| Main action | Dark approximately 220 px pill beside an underlined shop link. | Main action is 218 px minimum width with the matching small arrow; the secondary action remains a plain underline. Both are functioning controls. |
| Palette | Pale ivory page, near-black ink, natural reds and pinks, restrained hairlines. | Locked `#f7f7f2` page and `#20231e` ink. Images have no tint, gradient, wash, or overlay. |
| Photography | Sculptural red/pink hero; three open florist photographs. | A matching standalone generated hero replaces the raster concept. Catalog-family roses and red tulips are intentional, source-consistent substitutions. No UI text is baked into the images. |
| Shop anatomy | Three images followed by merchant names, locality, and “Visit shop”. | Same open rail and hierarchy. English merchant names and English locality transliterations are the approved content migration. |
| Application continuation | Open composer, lime checkboxes, honest activity table, flat product quote and order form. | The implementation follows these component families; real answers, failures, alternatives, quotes, and activity are populated from the backend. |

## Above-the-fold copy comparison

Unchanged: `AskAgent`, `The demo`, `Live activity`, `Protocol`, `Good things.`, `Delivered by agents.`, the full supporting sentence, `Try in ChatGPT`, `Explore the shops`, `Find your florist`, `Independent shops. Real constraints.`, and `Visit shop`.

Approved replacements: merchant names are `Rose & Stem`, `Petal Atelier`, and `Tulip House`; localities use `Kadikoy`, `Moda`, `Uskudar`, and `Istanbul`. These replace the original Turkish labels following the user’s request that all production content be English. No decorative eyebrow, metric, claim, or additional hero label was added.

## Intentional differences and verification limits

All catalog prices, availability, delivery times, card messages, and quote totals come from the authoritative backend rather than illustrative concept values. The canonical example is 25 red roses to Kadikoy by 20:00, under 1,500 TRY including delivery, with the card message “Happy birthday, Mom.” Photos illustrate catalog families and are not evidence of exact stem counts. English translations and these source-based substitutions are recorded in `design-spec.md`.

The browser development capture contains Next.js development chrome in the lower-left corner. This is absent from the production build; it is not product UI.

The primary screen was faithfully verified against the accepted concept. No fixable material visual mismatch remains in this reviewed screen. Native ChatGPT browsing compatibility is explicitly conditional in the UI and protocol documentation; this review does not claim an end-to-end native ChatGPT test. Root owns the final deployed-site interaction check, including the three merchant outcomes, quote handoff, demo order, and activity/referee updates.
