# GreenVital Apps

A minimal multi-page website for GreenVital Apps featuring:

- A homepage for the GreenVital app collection
- A dedicated page for Back to Life
- A dedicated page for Money Pulse

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

- [Offline Vault Windows release infrastructure handoff](docs/offline-vault-windows-release-handoff.md)
- Validate a future candidate manifest with `node scripts/validate-offline-vault-windows-release.mjs /path/to/release.json`.
- Run the live check only after publishing the signed artifacts and `release.json` in the documented order.
