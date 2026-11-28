# Website navigation and page hierarchy

Visitors can open Apps from every shared site header, compare the six apps by
purpose, platform and availability, then follow a dedicated product page. Support
has its own app directory. Offline Vault downloads are named explicitly and
linked from that product's context. The existing download URL remains available.

The homepage provides a shorter overview. Cloud Drop setup instructions live on
the product and service pages, while the homepage describes its role and links to
the service. At a 1440px viewport, the homepage height changed from 6334px to
3422px, including the footer. This measures length, not conversion or usability.

PetShift introduces the owner and sitter views before explaining setup. Its local
navigation links to each audience, workflow, screenshots and privacy/support.

The existing private pilot evidence page was retained from the latest main
branch. Consent, authentication and service scripts were outside this change.

## Verification

All 33 pages passed layout checks at 320px, 375px and 1440px in Chrome, and a 375px
WebKit sweep. Static internal links and fragments resolve. Chrome and WebKit
passed the mobile journeys from Home to Apps to PetShift to the sitter section,
and from Apps to Offline Vault downloads. Existing preview, menu, dialog,
keyboard and reduced-motion checks passed. Seven key mobile pages reported zero
axe WCAG 2 A/AA and 2.1 AA violations.

These checks cover rendering and navigation. They do not establish how visitors
understand the app choices or how well the pages convert.

## Compact homepage and Cloud Drop placement

Cloud Drop is reached from the Offline Vault product page through its local
navigation and Use Cloud Drop action. The shared studio header contains Apps,
Support and About. The homepage and Apps directory direct visitors to the app
before exposing its optional web companion.

Visible homepage main text fell from 392 to 180 words in the default desktop
state. Height at 1440px fell from 3422px to 2477px. All six app summaries and their
availability labels remain accessible. The previous root #cloud-drop bookmark
lands at the Offline Vault card.

All 33 pages passed 320px, 375px and 1440px Chrome layout checks. Seven key mobile
pages had zero axe WCAG violations. Chrome and WebKit passed the route Home to
Apps to Offline Vault to Cloud Drop. Existing preview, menu, dialog, keyboard,
reduced-motion and no-JavaScript checks passed. Service file preparation and
account transactions were outside this navigation check.
