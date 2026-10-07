# Offline Vault Windows Sideload Release Handoff

Status: **verified draft, hosting blocked, controls disabled**

Offline Vault Companion 1.0.0 is prepared as a self-signed Windows sideload release. It is not a Microsoft Store package and is not signed by a generally trusted certificate authority. Users must verify and install the GreenVital public certificate into Local Machine Trusted People before opening App Installer.

## Verified draft

- Private repository: `AcePhelps/offline-vault`
- Draft tag: `windows-v1.0.0-sideload`
- Draft release remains unpublished.
- Certificate subject and issuer: `CN=GreenVital`
- Certificate SHA-1: `FC677345547ACF903AC8ABBEEEBD79A30318889C`
- Bundle SHA-256: `81b1dc004993fffe56ab9ba75cd26991df1468a9d97fa1965a6af03921540a5e`
- Bundle size: `125803957` bytes
- Architectures: x64 and ARM64
- Minimum Windows version: `10.0.17763.0`

The four draft assets were downloaded with GitHub CLI and independently verified byte-for-byte. The public `.cer` is safe to distribute. Never publish or request a private key, PFX, or certificate password.

## Exact public URLs

```text
https://downloads.greenvital.app/offline-vault/windows/OfflineVaultCompanion-1.0.0.msixbundle
https://downloads.greenvital.app/offline-vault/windows/OfflineVaultCompanion.appinstaller
https://downloads.greenvital.app/offline-vault/windows/GreenVital-OfflineVault.cer
https://downloads.greenvital.app/offline-vault/windows/release.json
```

These URLs are already encoded in `release.json` and `OfflineVaultCompanion.appinstaller`. The files must be uploaded byte-for-byte without renaming, reformatting, or regenerating them.

## Why publication is blocked

- `downloads.greenvital.app` has no DNS record.
- No object-storage or CDN credentials are configured on this host.
- The 125,803,957-byte bundle exceeds GitHub's 100 MiB repository-file limit, so it cannot be committed to the existing GitHub Pages repository.
- The draft release is private and must remain a draft, so its authenticated asset URLs cannot be used as public installer endpoints.

The GreenVital product and download pages therefore pin the verified fingerprints but keep every download control disabled with `WINDOWS_SIDELOAD_ENABLED = false`.

## Required hosting configuration

Use object storage behind an HTTPS CDN that supports a custom subdomain. A private Amazon S3 bucket behind CloudFront works with the existing Porkbun DNS without moving the main website.

| File | Content-Type | Content-Length | Cache-Control |
| --- | --- | ---: | --- |
| `OfflineVaultCompanion-1.0.0.msixbundle` | `application/msixbundle` | `125803957` | `public, max-age=31536000, immutable` |
| `OfflineVaultCompanion.appinstaller` | `application/appinstaller` | `662` | `public, max-age=300, must-revalidate` |
| `GreenVital-OfflineVault.cer` | `application/x-x509-ca-cert` | `1022` | `public, max-age=31536000, immutable` |
| `release.json` | `application/json` | `514` | `public, max-age=60, must-revalidate` |

Requirements:

- HTTPS with a valid certificate for `downloads.greenvital.app`.
- No redirects on any of the four URLs.
- `Access-Control-Allow-Origin: https://greenvital.app` on GET and HEAD responses.
- `Access-Control-Expose-Headers: Content-Length, Accept-Ranges, Content-Range` so the website can verify hosted files before enabling controls.
- Accurate `Content-Length` on GET and HEAD.
- Byte-range support for the bundle. `Range: bytes=0-0` must return HTTP 206 and `Content-Range: bytes 0-0/125803957`.
- No content transformation or compression for the bundle.

## DNS

After the storage/CDN distribution is configured and its HTTPS certificate is ready, add this Porkbun record:

| Type | Host | Answer / value | TTL |
| --- | --- | --- | --- |
| CNAME | `downloads` | provider-assigned CDN hostname | 600 |

If the CDN uses DNS validation for its certificate, first add the provider-generated validation CNAME exactly as supplied. Do not create A or AAAA records for the download subdomain unless the selected provider explicitly requires fixed addresses.

## Publication order

1. Provision the storage bucket, CDN, certificate, CORS, MIME, cache, and range settings.
2. Upload the bundle, App Installer file, and public certificate byte-for-byte.
3. Verify those three public URLs and headers.
4. Upload `release.json` last.
5. Run `node scripts/validate-offline-vault-windows-release.mjs --live`. This downloads all four public files, checks their exact hashes and sizes, validates the certificate and encoded URLs, and tests CORS and byte ranges.
6. Only after the live validator passes, change `WINDOWS_SIDELOAD_ENABLED` to `true` in `/offline-vault/releases.js`.
7. Deploy the website and verify both `/offline-vault/` and `/downloads/` activate all links.

## User installation flow

1. Download `GreenVital-OfflineVault.cer` only from `downloads.greenvital.app`.
2. Confirm SHA-1 thumbprint `FC677345547ACF903AC8ABBEEEBD79A30318889C`.
3. Open the certificate, choose Install Certificate, select Local Machine, and place it in Trusted People.
4. Download and open `OfflineVaultCompanion.appinstaller`.
5. If using the direct bundle, confirm SHA-256 `81b1dc004993fffe56ab9ba75cd26991df1468a9d97fa1965a6af03921540a5e` before installation.

Installing a certificate in Local Machine Trusted People affects the computer's trust configuration and normally requires administrator approval. Users should remove the certificate if they no longer want to trust GreenVital sideload packages.

## Owner input required

- An object-storage/CDN provider account or credentials with permission to create the origin and upload these four files.
- Porkbun DNS access when the provider supplies the CDN and certificate-validation targets.

Do not provide private signing material. This release uses only the already-verified public certificate asset.
