# GreenVital Apps

A static, responsive website for GreenVital Apps featuring:

- A homepage for the GreenVital app collection
- Product pages for Money Pulse, Back to Life, GreenVital Wellness, Offline Vault, PetShift, and StoragePilot
- Cloud Drop, the optional web service for Offline Vault
- A shared support directory at `/support/` and policy directory at `/privacy/`

## Website design

`greenvital.css` defines the shared blue-and-white theme, accessible focus styles,
navigation, buttons, and homepage layouts. `greenvital-pages.css` contains the
product, support, policy, download, and app-handoff layouts. Use the `gv-` class
prefix for new site components. Cloud Drop keeps its own existing styles and
application scripts under `offline-vault/drop/`.

Keep product availability and pricing explicit. Offline Vault's iPhone/iPad and
Mac apps are free. Cloud Drop has a separate free trial; paid checkout remains
controlled by its backend. Preserve legal text and dates during visual edits,
PetShift's `data-bridge-*`/`data-open-app` hooks, and the verified Windows release
attributes used by `offline-vault/releases.js`.

## Local preview

Run:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173`.

## GitHub Pages

This site is ready for GitHub Pages hosting as a static website.

If you use the custom domain `greenvital.app`, keep the `CNAME` file in the repo.

## Release operations

- [Offline Vault Windows sideload release handoff](docs/offline-vault-windows-release-handoff.md)
- Recheck draft assets with `node scripts/validate-offline-vault-windows-release.mjs --assets /path/to/assets`.
- Run the live validator before enabling any sideload download control.
