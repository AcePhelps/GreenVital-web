# GreenVital and PetShift website refresh

The studio site uses self-hosted Geist typography, a blue and navy palette,
restrained motion and a grid behind real product screenshots. PetShift uses green
accents across its product and invitation pages.

The homepage app preview switches between Money Pulse, Offline Vault and PetShift.
It supports mouse, touch and keyboard navigation. It never changes automatically.
Product screenshots open in a native dialog with Escape, a visible close control
and focus restoration. The mobile menu supports Escape and stays available as
ordinary navigation when JavaScript is disabled. Reduced motion suppresses the
preview and dialog animations.

The new site script has no runtime dependencies. The 29 KB WOFF2 font is hosted by
the site under the included license in assets/fonts/OFL.txt. Ten WebP screenshot
derivatives reduce the corresponding image payload from 6,982,405 to 1,045,864
bytes, about 85 percent. Responsive variants serve smaller screens, and the screenshot dialog loads the full-size derivative. Original screenshots remain available for social previews.

Product availability, legal policies, consent handlers, release controls and app
handoff scripts retain their existing behavior.

## Verification

All 31 HTML pages loaded locally at widths of 320, 375 and 1440 pixels in Chrome
(93 page and viewport checks). Each page had one primary heading and one main
landmark. No horizontal document overflow, JavaScript exceptions or missing image
sources occurred. Every static internal file link and fragment target resolved.

Chrome interaction checks passed for all preview tabs, keyboard selection and
wrapping, reduced motion, mobile menu behavior, screenshot dialogs, focus return
and navigation without JavaScript. WebKit mobile checks passed for app switching,
menu navigation and screenshot dialogs. All 31 pages also passed a WebKit layout check at 375px.

Automated axe WCAG 2 A/AA and 2.1 AA checks reported zero violations on the mobile
homepage, PetShift product, PetShift privacy, invitation landing, support and
downloads pages. The test browser bypassed CSP only to inject axe. Application CSP
was retained. These automated checks do not replace screen-reader QA.

Cloud Drop service operations, payments, real invitation enrollment and native app
handoff were excluded from visual checks. Local browser audits blocked remote
service requests. Cloud Drop's generated image placeholders have no src until
application data loads.

A local mobile Lighthouse run scored 100 for performance, accessibility, best
practices and SEO. Largest contentful paint was about one second with zero
cumulative layout shift. These measurements describe the local release candidate.
