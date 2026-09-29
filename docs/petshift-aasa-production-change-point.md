# PetShift AASA production app identifier change point

The live `/.well-known/apple-app-site-association` file currently contains only the approved iOS development app entry:

`LU7KD3F268.com.greenvital.petshift.dev`

When the final production Apple Team ID and production bundle identifier are confirmed, update `/.well-known/apple-app-site-association` by adding or replacing the appropriate `applinks.details[].appID` entry with the confirmed production app identifier.

Do not invent, guess, or publish a production app identifier before it is confirmed. Keep the existing allowed paths unless the app routing contract changes:

- `/auth/confirm/*`
- `/auth/reset/*`
- `/invite/*`

Hosting requirement: Apple must receive `/.well-known/apple-app-site-association` directly over HTTPS, without redirects, and with an Apple-accepted JSON content type such as `application/json`.
