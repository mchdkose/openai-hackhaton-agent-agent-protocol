# Native-assistant demonstration

## Opening request

Replace `PUBLIC_ORIGIN` with the deployed HTTPS origin. In native ChatGPT:

Current public demo origin: `https://askagent-hackathon-demo.pages.dev`.

> My mother's birthday is tonight. I need at least 25 red roses delivered to Kadikoy by 20:00, under 1,500 TRY including delivery. Ask the three shops on this website for their current answers and compare them: PUBLIC_ORIGIN/askagent

The expected catalog result is Rose & Stem: exact match, 1,370 TRY; Petal Atelier: cannot deliver today; Tulip House: can deliver but only substitutes. The catalog is a fictional scenario anchored to the displayed demo clock.

## Conversation continuity

> Confirm the total price and delivery promise with the shop that can fulfil my request. Add the card message “Happy birthday, Mom.”

The merchant's returned full transcript link can be opened in another assistant. This is a separate compatibility test; a UI button is not evidence of cross-assistant behavior.

## Human handoff

> Give me the shop's link to review and confirm the chosen bouquet.

Open the returned merchant product page. Show the total including delivery, the card message and “Why this selection?”. The handle disappears from the address bar. A human explicitly confirms the simulated order.

## Observable proof

The live activity page displays actual calls and handoffs. The isolated false-claim test demonstrates rejection of a claim conflicting with the catalog. It is labelled as a synthetic test and is not presented as an actual provider mistake.

## Compatibility matrix

Record each test as passed, partial, failed or untested, with date and exact surface. Required checks: discovery from a single link; custom question URL; handle preserved on follow-up; quote link; full transcript opened in a second assistant; human handoff. A local fetch, playground call or API model is not a native ChatGPT test.

Current verification, 12 October 2026 (Europe/Istanbul):

| Check | Surface | Status | Evidence |
| --- | --- | --- | --- |
| Public deployment | Cloudflare Pages and Worker | Passed | Deployment completed at `https://askagent-hackathon-demo.pages.dev`; no custom domain is attached. |
| Published protocol-document homepage | Codex in-app browser, production HTTPS desktop | Passed | The published English protocol document was confirmed on desktop. Screenshot: `artifacts/screenshots/production-protocol-document.png`. |
| Protocol-document mobile layout | Codex in-app browser, local 390 × 844 mobile viewport | Passed | The document fits without horizontal overflow and retains a ChatGPT CTA with the canonical public origin and full prompt. Production mobile was not separately checked. |
| Public example question and returned links | Codex in-app browser, production HTTPS | Passed | The complete GET chain worked: actual example question, returned Continue link, verified quote, and checkout envelope. The card message persisted and the quote total was 1,370 TRY. This browser result does not establish native ChatGPT compatibility. |
| Independent merchant comparison | Codex in-app browser, production HTTPS | Passed | Rose & Stem: 25 red roses, 1,370 TRY with delivery today at 19:30. Petal Atelier: 20 roses, tomorrow delivery, requirements not met. Tulip House: 25 pink roses, 1,100 TRY with free delivery today at 20:00, explicitly an alternative because red roses are unavailable. |
| Follow-up continuity | Codex in-app browser, production HTTPS | Passed | The merchant handoff preserved the card message, 25-stem minimum, 1,500 TRY budget, and 20:00 deadline. |
| Prepared quote and human handoff | Codex in-app browser, direct production merchant link | Passed | The product page rendered 25 red roses, 1,280 TRY product + 90 TRY delivery = 1,370 TRY, delivery today at 19:30, and the saved card message. JavaScript removed the handle from the address bar. |
| Playground prepared-order action | Codex in-app browser, production HTTPS | Failed | This button parsed a default Markdown quote response as JSON. Direct merchant-link handoff passed. Explicit JSON negotiation is fixed and typecheck passed; the button's production retest is pending. |
| Simulated order | Codex in-app browser, production merchant page | Passed | Fictional inputs and explicit human confirmation produced a demo order for 1,370 TRY, today at 19:30, with no payment taken. Screenshot: `artifacts/screenshots/production-order.png`. Production idempotency was not retested. |
| Automated production HTTP smoke | Node fetch, Python urllib, IPv4 curl | Partial | Production DNS resolves, but these clients received TLS connection resets before HTTP. The smoke suite did not execute against production and created no order. |
| Storefront catalog comparison | Native ChatGPT, existing user conversation | Passed | ChatGPT compared the storefront pages itself and explicitly said the site's agent did not answer. This proves page reading, not an AskAgent conversation. |
| Merchant-agent discovery | Native ChatGPT, existing user conversation | Passed | All three merchant AskAgent discovery endpoints were readable by ChatGPT's web tool. |
| Dynamic agent question, quote, and checkout | Native ChatGPT browser conversations | Partial | Question GET URLs were inaccessible; a direct published-link click also reported “400 Timeout fetching”. No site-agent answer, handle, quote, or checkout was returned. This is a web-tool error, not a verified application response. The complete agent flow remains unverified. |
| Transcript in a second assistant | Native assistant product | Untested | No cross-assistant product test has been observed. |

Sanitized production evidence is recorded in `artifacts/production-verification.json`. The existing `artifacts/smoke-result.json` records local verification and must not be presented as production or native ChatGPT evidence.

The latest deployment introduces explicit JSON negotiation for the prepared-order button and a shared model deadline, with a seven-second default, to address the native-assistant timeout. A deterministic mocked-provider test verifies that later model stages only receive the remaining time, exhausted stages make no new provider call, and internal deadlines are absent from usage output. The revised homepage and complete public GET chain passed in the production browser. Fresh native ChatGPT attempts still read discovery only and could not access question URLs, including the direct-link attempt. Its web tool presented an older homepage without the newly published example-question link; this differs from the current production in-app browser result.

Local validation after the quantity-extraction revision: all 33 unit tests passed. Typecheck passed before that final revision; the deployment build provides its compilation check. Native agent-question compatibility remains unverified.
