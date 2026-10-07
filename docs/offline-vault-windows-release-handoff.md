# Offline Vault Windows Manual Release Handoff

Status: **blocked and unpublished**

Offline Vault Companion for Windows will be distributed as a manual ZIP download from the existing GreenVital GitHub Pages website. The public page must remain `Coming soon` until a trusted production-signed and timestamped package passes every gate below.

## Public URLs

- Download center: `https://greenvital.app/downloads/`
- Future ZIP: `https://greenvital.app/downloads/offline-vault/windows/OfflineVaultCompanion-{version}.zip`
- Product page: `https://greenvital.app/offline-vault/`

No App Installer feed, automatic updater, download subdomain, DNS change, S3 bucket, or CDN is required for this manual release plan.

## Current gate

- `/offline-vault/releases.json` contains a truthful `windows.status` value of `coming-soon`.
- No Windows ZIP is present under `/downloads/offline-vault/windows/`.
- Both the product page and download center keep the Windows button disabled.
- The page enables the button only when the manifest is complete and a same-origin `HEAD` request confirms the ZIP exists with the exact declared byte size.
- The existing self-signed test certificate is not release eligible.

## ZIP layout

The release archive must use this filename:

```text
OfflineVaultCompanion-{version}.zip
```

The ZIP must contain exactly one production-signed `.msixbundle`. It may also include a short installation text file. It must not contain signing keys, `.pfx`, `.p12`, `.pem`, `.key`, or `.appinstaller` files.

Keep the ZIP at or below GitHub's 100 MiB per-file limit. If a future package exceeds that limit or download traffic outgrows GitHub Pages, move artifacts to dedicated storage before publishing rather than splitting or disguising the package.

## Manifest contract

When the final ZIP is ready, update the `windows` object in `/offline-vault/releases.json`:

| Field | Required value |
| --- | --- |
| `status` | `available` |
| `version` | release version used in the ZIP filename |
| `minimumWindowsVersion` | approved minimum Windows version |
| `architectures` | unique array containing `x64`, `arm64`, or both |
| `downloadUrl` | `/downloads/offline-vault/windows/OfflineVaultCompanion-{version}.zip` |
| `sha256` | lowercase SHA-256 of the final ZIP |
| `sizeBytes` | exact byte size of the final ZIP |
| `releaseDate` | release date in `YYYY-MM-DD` format |

Do not insert estimated or placeholder values. Generate the checksum and size from the exact ZIP committed to the website.

## Release order

1. Obtain a trusted production code-signing certificate or managed signing service.
2. Sign the final x64 and ARM64 MSIX bundle with the production publisher identity and a trusted RFC 3161 timestamp.
3. On Windows, run `signtool verify /pa /all /v` against the final bundle and confirm the trusted timestamp, publisher, identity, version, and architectures.
4. Install the bundle on a clean supported Windows machine and repeat the same-Wi-Fi iPhone pairing and transfer flow.
5. Create `OfflineVaultCompanion-{version}.zip` containing exactly that verified bundle.
6. Place the ZIP in `/downloads/offline-vault/windows/`.
7. Compute the ZIP SHA-256 and byte size, then update `/offline-vault/releases.json` from `coming-soon` to `available`.
8. Run `node scripts/validate-offline-vault-windows-release.mjs` from the website repository.
9. Review the diff to confirm no certificate, private key, test package, or unrelated file is included.
10. Commit and push the ZIP and manifest together, then wait for the GitHub Pages deployment to succeed.
11. Verify the live ZIP returns HTTP 200 with the expected `Content-Length` and checksum.
12. Verify the buttons on `/offline-vault/` and `/downloads/` activate and download the same ZIP.

## Rollback

To withdraw a release, change the Windows manifest entry back to the fully empty `coming-soon` state and remove the ZIP in the same commit. The static disabled button remains the fallback if the manifest or ZIP is unavailable.

## HTTPS note

GitHub Pages has an approved certificate for `greenvital.app`, but its `Enforce HTTPS` setting is currently off. Enable it before publishing the first Windows ZIP so HTTP requests redirect to HTTPS.

## Remaining owner inputs

- Trusted production code-signing certificate or managed signing account.
- Final publisher identity and approved minimum Windows build.
- Confirmation that the final ZIP is below 100 MiB.
- Authorization to enable GitHub Pages `Enforce HTTPS` before release.

Never commit or send the signing private key through chat.
