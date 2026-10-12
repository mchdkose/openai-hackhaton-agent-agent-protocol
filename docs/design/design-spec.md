# AskAgent visual specification

This specification records the accepted implementation direction chosen under the user's request to make the choices and begin development. It is a practical visual reference for the working protocol demo, not a promise about ChatGPT compatibility or a source for merchant stock and prices.

## References

All concepts were generated with the built-in ImageGen tool before frontend implementation and inspected with `view_image`.

- `primary-screen.png` — 1487 × 1058. Homepage navigation, complete hero, and three-shop row.
- `composer-activity.png` — 1799 × 874. Request form and actual activity section.
- `merchant-handoff.png` — 1487 × 1058. Product, authoritative quote, and demo order form.

## Visual direction

Editorial boutique commerce: pale ivory, near-black ink, deliberate whitespace, oversized clean sans typography, natural flower photography. A warm human outcome is visible first; operational details become visible where they help someone make a decision.

The layout uses open sections, rows, form regions, and tables. No bento grid, card borders around every region, decorative badges, gradients, glow, fake statistics, invented reviews, testimonials, pseudo-activity, or hero eyebrow. Text and controls are implemented in code. Only the flower photographs are raster assets.

## Locked tokens

| Token | Value | Use |
| --- | --- | --- |
| Page | `#f7f7f2` | Exact pale ivory page choice |
| Surface | `#ffffff` | Textareas and form inputs |
| Ink | `#20231e` | Headings, primary buttons, normal text |
| Muted | `#6c6f69` | Paragraphs, locality, captions |
| Line | `#dcded6` | Hairline dividers and controls |
| Accent | `#c4df92` | Checked shop controls and continuity note |
| Danger | `#9b3d33` | Real error states; never decorative |
| Font | `Inter`, `Arial`, `Helvetica`, sans-serif | UI and content |
| Heading weight | 650–700 | Headings and wordmark |
| Body weight | 400 | Paragraphs and form text |
| UI weight | 500 | Links, labels, buttons |
| Hero title | `clamp(48px, 5.2vw, 80px)` | Tight line-height 0.99; tracking −0.055em |
| Section title | 36–44px | Line-height 1.08; tracking −0.035em |
| Product title | 46–56px | Line-height 1.04; tracking −0.045em |
| Body | 18–20px | Line-height 1.5 |
| UI | 14–16px | Line-height 1.4 |
| Caption | 12–14px | Line-height 1.5 |
| Page gutter | 52px desktop; 24px tablet; 20px mobile | Shared alignment |
| Section gap | 64–96px | Breathable sections |
| Grid gap | 20px shop row; 48–64px hero/form | Consistent content rhythm |
| Media radius | 14–16px hero; 4px thumbnails | Match concept geometry |
| Input radius | 8–12px | Form fields |
| Button radius | 999px | Primary and outlined actions |
| Elevation | none | Depth comes from natural photography |
| Motion | 160ms ease-out | Hover/control feedback only |

Keyboard focus uses a visible ink outline with a 3px ivory offset. Errors have readable text. Disabled controls preserve legibility. Respect reduced-motion preferences.

## Homepage and allowed opening copy

The navigation is 64–72px high with the bold `AskAgent` wordmark left and essential links right: `The demo`, `Live activity`, `Protocol`. A hairline separates it from the page. No extra header widgets.

The hero begins roughly 26px below navigation. Use an open two-column grid, close to 50/50 with a 32–48px gap. Copy is vertically centered against the image. At 1487px the first-column headline is approximately 80px and occupies exactly two lines:

```text
Good things.
Delivered by agents.
```

Supporting copy:

```text
Three flower shops. One request. Your assistant handles the conversation.
```

The left action row is a near-black pill `Try in ChatGPT ↗` followed by a plain underlined text action `Explore the shops →`. Avoid decorative icon circles. A small actual arrow glyph is sufficient. The ChatGPT action must perform a usable action such as copying/opening the complete public demo prompt; do not present an unverified integration claim.

The right hero image is `hero-bouquet.webp`, a landscape 4:3 photo, `object-fit: cover`, no overlay, tint, mask, gradient, text, or washed-out filter. Preserve deep reds and dusty pinks. This photo is the opening focal point.

After a divider, the shop row uses the heading `Find your florist` and the caption `Independent shops. Real constraints.` It is an open three-column image rail with 3:2 thumbnail crops; no outer cards or shadows. Each shop has an image, a 22–24px name, locality, and underlined `Visit shop ↗` action.

| Shop | Locality | Production image |
| --- | --- | --- |
| Rose & Stem | Kadikoy, Istanbul | `red-roses.webp` |
| Petal Atelier | Moda, Istanbul | `pink-roses.webp` |
| Tulip House | Uskudar, Istanbul | `red-tulips.webp` |

## Request composer

Match `composer-activity.png`. An open two-column region: narrative left, real controls right. Exact copy:

```text
A request worth making.
Tell the shops what you need. Watch the conversation happen.
Example request
My mother’s birthday is tonight. Send at least 25 red roses to Kadikoy by 20:00, under 1,500 TRY including delivery. Add the card message “Happy birthday, Mom.”
Your request
Shops to compare
Compare the shops ↗
A demo request. No payment is taken.
```

The right side contains a large labelled white textarea with thin border, a row of three native checkboxes with lime selected treatment, and a near-black pill submit button. Checked shop names match the homepage. Do not replace checkboxes with decorative selection pills.

Real response results extend underneath the composer using the same open row/column system, exact backend status and message text, source links, follow-up control, and quote/handoff action. Real requests may be loading, fail, be rejected, return an alternative, or produce a quote. Do not make every merchant appear successful. Pending and error states must retain the last safe data and useful explanation.

## Live activity and operational view

The activity section is a clean table with `Live activity` heading and outlined `Refresh` action. Use a thin top/bottom divider, restrained uppercase small column labels, and generous rows. Suggested readable columns are `TIME`, `SHOP`, `EVENT`, and `STATUS`, mapped to real event data. A deeper technical panel may additionally show session, verification, turn number, and sources if useful.

The honest empty state is `No conversations yet.` followed by `Start a request or open a shop link in ChatGPT.` Do not pre-populate synthetic metrics or fabricated activity. A technical panel follows the same ivory background, flat rows, typography, and hairlines; no unrelated dashboard theme.

## Merchant storefront and handoff

Match `merchant-handoff.png`: merchant wordmark left, `Back to AskAgent ↗` right, divider, large product photo left, product/quote and completion form right. Use the real merchant name, catalog title, district, and availability. Example values drawn inside the image are visual examples only: the implementation must use current backend catalog/quote amounts.

The authoritative price breakdown is a flat list separated by hairlines: `Product`, `Add-ons`, `Delivery`, and `Total`. The total is semibold. Include any omitted/nonapplicable item only when the quote explicitly includes it. Stock or same-day promise may be shown only if current source facts support it.

If a valid assistant quote/conversation is present, a narrow lime continuity band reads `Your assistant’s selection is here. Complete the details.` Display selected product, count, vase/delivery options and agreed total from server session. Invalid/expired context must explain itself instead of silently showing an unrelated quote.

The compact labelled real form has `Recipient name`, `Delivery address`, `Phone`, and `Card message`. Use a wide near-black CTA `Create demo order ↗`, then readable small text `Demo order. No payment is taken.` Validation and success are real server states, with no payment captured. A success receipt uses the same typography and open fact rows, preserving the source session/order reference.

## Components and container inventory

| Family | Variants |
| --- | --- |
| Navigation | AskAgent root; merchant name; compact back link |
| Button | Black primary pill; plain underlined text; outline refresh |
| Media | Hero landscape; shop 3:2 rail crop; product square or portrait |
| Heading | Hero; section; merchant/product; small result/shop title |
| Form | Label, input, textarea, checkbox, error, disabled/loading |
| Result | Pending, source-backed answer, rejected/alternative, quote |
| Table | Real activity and technical-panel rows, empty state |
| Facts | Product/option/delivery/total list; continuity band; receipt |

Arrow glyphs are `↗` or `→`, rendered at the same visual size as button/link text, with 8px separation. There is no other icon inventory unless a functional control requires a familiar icon. Use a consistent thin stroke family for any newly required control.

## Responsive continuation

At tablet width reduce gutters to 24px and heading to 56–64px. Below roughly 850px stack the hero with copy before image and retain its 4:3 crop; wrap essential nav without horizontal overflow. Below 720px stack the shop row, request columns, response columns and handoff page. Use 20px gutters and 44–50px hero title. Keep text and input sizes readable at 16px minimum; let the hero's second line wrap when the screen physically requires it. The activity table may scroll within its own region or become labelled rows; do not make the whole page scroll horizontally. Inputs fill available width; touch controls have at least 44px targets.

## Asset handling and provenance

Production assets were created by built-in ImageGen, not downloaded or taken from a real florist. They are demonstration product imagery. WebP conversion used the bundled Sharp runtime at quality 88; no retouching or content changes were introduced during conversion.

| File | Native dimensions | Weight | Role |
| --- | --- | --- | --- |
| `public/images/hero-bouquet.webp` | 1448 × 1086 | 205 KB | Homepage hero |
| `public/images/red-roses.webp` | 1254 × 1254 | 220 KB | Red-rose catalog family and first shop |
| `public/images/pink-roses.webp` | 1254 × 1254 | 199 KB | Pink-rose catalog family and second shop |
| `public/images/red-tulips.webp` | 1254 × 1254 | 158 KB | Red-tulip catalog family and third shop |

The original concept's third photograph showed apricot/pink tulips; the final catalog family is red tulips. Final production imagery follows catalog truth. The first shop's concept showed paper-wrapped roses; production uses the same red-rose vase arrangement as the catalog. These are intentional asset substitutions with the same lighting, composition, and boutique style. Quantity and actual composition are determined by catalog facts; generated family imagery must not be treated as exact stem-count evidence.

Use semantic alt text, for example `Red roses and eucalyptus branches in a clear glass vase`. Reserve image dimensions/aspect ratio to prevent layout shift. Load hero eagerly; below-fold photos may load lazily. Do not ship UI concept screenshots as storefront assets.

## Approved English content revision

The user requested that everything be in English after the initial concepts. All production UI, catalog names, agent answers, error messages, card examples, and protocol instructions therefore use English. The three public merchant IDs are `rose-and-stem`, `petal-atelier`, and `tulip-house`. English transliterations are used for Kadikoy, Besiktas, Uskudar, and Istanbul. Concept screenshots retain their original example copy as visual references; production translations and authoritative catalog amounts intentionally replace those examples while retaining layout, typography, colors, image framing, and interaction geometry.

## Verification handoff

The frontend owner must inspect the accepted concept and the latest rendered browser screenshot with `view_image` before calling the build visually complete. Compare palette, headline line breaks and scale, navigation alignment, hero aspect/crop, open shop-row framing, form geometry, honest activity state and product handoff. Verify real controls, responsive widths, no horizontal overflow, image loading, empty/error states, and quote-to-order continuity.

## Generation prompts

The primary screenshot brief specified the full header/hero/shop-row screen, exact copy, ivory/ink/lime palette, oversized grotesk type, 52px gutters, no hero eyebrow, open three-shop row, and natural sculptural burgundy/pink flower photography. The composer screenshot brief specified only the downstream two-column request form and honest empty activity table. The handoff screenshot brief specified the product photo, authoritative price-list geometry, lime continuity band and complete demo order form.

The hero asset prompt recreated only the right-side photo from the accepted concept. The red-rose asset prompt recreated only the left-side photo from the accepted handoff concept. The pink-rose and red-tulip prompts requested complete standalone vase arrangements on ivory stone with pale warm-grey backdrop, realistic detailed petals, upper-left natural side light, square crop, no text, watermark, people, UI, or overlays. These same constraints and photo treatment govern any future catalog-family asset.
