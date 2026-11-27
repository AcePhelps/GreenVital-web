# GreenVital and PetShift visual refresh

The shared site uses self-hosted Geist typography, a blue and navy palette, subtle
surface depth and a technical grid behind the homepage app screenshots. PetShift
product and invitation pages use green accents. Product copy, policy text, dates,
script hooks and link destinations retain their existing values.

## Verification

All 31 HTML pages loaded locally at widths of 320, 375 and 1440 pixels in Chrome
(93 page and viewport checks). Each page had one primary heading and one main
landmark. No horizontal document overflow or JavaScript exceptions occurred.
Every static internal file link and fragment target resolved. HTML comparison
confirmed the only document edits were stylesheet version parameters.

Screenshot review covered the homepage, PetShift product page and mobile layouts.
The review used reduced motion and verified the system motion preference suppresses
the new arrival animation. All existing source images were retained.

Cloud Drop network services and payment, authentication and invitation workflows
were excluded from local visual checks. Two Cloud Drop image elements have no src
until application data loads. Browser checks blocked remote service requests.
External service operation and native app handoff require their existing checks.

Font files are hosted by the site and distributed under the included SIL Open Font
License in assets/fonts/OFL.txt.
