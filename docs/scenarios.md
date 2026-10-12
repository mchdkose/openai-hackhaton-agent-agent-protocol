# AskAgent scenario prompts

All amounts are TRY. These are seeded merchant facts for the hackathon demo.
The website agent must read its tools and answer through the real LLM. This
document describes checks to demonstrate, not canned responses.

| Request | Source-backed check |
| --- | --- |
| Send at least 25 red roses to Kadikoy tonight by 20:00, under 1,500 including delivery. | Rose & Stem GB-25R remains 1,370 total. Petal Atelier cannot satisfy tonight and quantity. Tulip House LE-25R is out of stock; LE-25P remains an explicitly different-color alternative at 1,100. |
| A white bouquet to Kadikoy, under 800 including delivery. | Rose & Stem GB-12W is 680; Tulip House LE-12W is 580. Petal Atelier MC-12W is 740 for next-day delivery, so timing matters. Ask whether roses or tulips are preferred if unspecified. |
| Send 50 red roses to Besiktas tomorrow, under 3,000 including delivery. | Rose & Stem GB-50R is 2,610; Petal Atelier MC-50R is 3,000; Tulip House LE-50R is 2,760. Read stock and published next-day start times. Do not promise an exact appointment. |
| I want 15 white tulips from Petal Atelier. If unavailable, suggest a substitute. | MC-15T is out of stock. Disclose that MC-12W changes both flower and count, while MC-20T changes color. No automatic substitution. |
| Add a glass vase to the 25-red-rose Kadikoy order, but keep the total below 1,500. | Rose & Stem bouquet plus delivery is 1,370; the published vase adds 250, yielding 1,620. The vase-inclusive order does not meet that budget. |
| Include a card message longer than 120 characters. | Every product card limit is 120. Ask for a shorter message and preserve the final wording; never silently truncate. |
| Deliver to Sisli tonight before 17:30. | Petal Atelier's published Sisli promise is today by 18:00; the other shops offer next day there. No shop can promise the requested deadline from the source data. |
| What is included in wrapping? Can you arrange flowers for a 40-person event? | Standard wrapping is included. Custom events are inquiries only: collect the brief, do not invent a custom price, booking, reservation or lead time. |
| Can the card omit my name, and what happens if the bouquet arrives damaged? | Read gift privacy and the published replacement policy. Do not invent a sender signature. The prototype can explain the policy but cannot complete a replacement claim. |

Conversation checks: ask a follow-up to change the color or budget; preserve
the opaque handle, district, deadline and final card text. Follow job-status URLs
until the LLM answer completes. Verify the quote and open the prepared product
page. A GET must create no order; the user alone confirms the explicit demo POST.

Catalog coverage: eight products per shop, six districts, red/pink/white roses
and tulips, small bouquets and 50-stem bouquets, limited and unavailable stock,
published add-on prices, wrapping, care, opening hours, occasions, privacy,
replacement policy and custom-event inquiry boundaries. White/pink illustration
assets are labeled catalog illustrations rather than exact product photographs.
