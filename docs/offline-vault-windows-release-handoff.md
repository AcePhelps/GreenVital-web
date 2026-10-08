# Offline Vault Windows Sideload Release Handoff

Status: **published and independently verified; download controls enabled**

Offline Vault Companion 1.0.1 is published as a self-signed, untimestamped Windows sideload release. It is not a Microsoft Store package and is not signed by a generally trusted certificate authority. The recommended one-file EXE installs the embedded public certificate and app after the user approves SmartScreen and UAC. The certificate, App Installer, and bundle remain available for manual installation.

## Verified release

- Private repository: `AcePhelps/offline-vault`
- The private GitHub draft release remains unpublished.
- Certificate subject and issuer: `CN=GreenVital`
- Certificate SHA-1: `FC677345547ACF903AC8ABBEEEBD79A30318889C`
- Certificate SHA-256: `E452A048C253EE0D1F6AC45B8B0DC1350E9A3DCCF946A240BF237F27DCB68484`
- Setup SHA-256: `c18f80eb39e73d8f2be305fa6982fc5c402a738746b081e8a49d31f212a64563`
- Setup size: `160738000` bytes
- Bundle SHA-256: `0d6cd33c40f9e837e2fa23ef3f81dd03c31c032a1e0b379f0d2e10ae9699080b`
- Bundle size: `125803977` bytes
- Architectures: x64 and ARM64
- Minimum Windows version: `10.0.17763.0`

All five public assets were independently verified byte-for-byte. The public `.cer` is safe to distribute. Never publish or request a private key, PFX, or certificate password.

## Exact public URLs

```text
https://downloads.greenvital.app/offline-vault/windows/OfflineVaultCompanion-Setup-1.0.1.exe
https://downloads.greenvital.app/offline-vault/windows/OfflineVaultCompanion-1.0.1.msixbundle
https://downloads.greenvital.app/offline-vault/windows/OfflineVaultCompanion.appinstaller
https://downloads.greenvital.app/offline-vault/windows/GreenVital-OfflineVault.cer
https://downloads.greenvital.app/offline-vault/windows/release.json
```

These URLs are already encoded in `release.json` and `OfflineVaultCompanion.appinstaller`. The files must be uploaded byte-for-byte without renaming, reformatting, or regenerating them.

## Live hosting configuration

The release assets are hosted on AWS behind `downloads.greenvital.app`. The GreenVital product and download pages pin the verified URLs, sizes, and fingerprints and enable download controls with `WINDOWS_SIDELOAD_ENABLED = true`.

| File | Content-Type | Content-Length | Cache-Control |
| --- | --- | ---: | --- |
| `OfflineVaultCompanion-Setup-1.0.1.exe` | `application/vnd.microsoft.portable-executable` | `160738000` | `public, max-age=31536000, immutable` |
| `OfflineVaultCompanion-1.0.1.msixbundle` | `application/msixbundle` | `125803977` | `public, max-age=31536000, immutable` |
| `OfflineVaultCompanion.appinstaller` | `application/appinstaller` | `660` | `no-cache` |
| `GreenVital-OfflineVault.cer` | `application/x-x509-ca-cert` | `1022` | `public, max-age=86400` |
| `release.json` | `application/json` | `1118` | `no-cache` |

Verified requirements:

- HTTPS with a valid certificate for `downloads.greenvital.app`.
- No redirects on any of the five URLs.
- Accurate `Content-Length` on GET and HEAD.
- Byte-range support for the setup and bundle. The bundle's `Range: bytes=0-0` response must include `Content-Range: bytes 0-0/125803977`.
- No content transformation or compression for the setup or bundle.

The website uses direct download anchors and pinned release metadata, so cross-origin browser reads are not required for installation. Repository validation still downloads and verifies every public byte before a release is enabled.

## Publication order

1. Provision the storage bucket, CDN, certificate, MIME, cache, and range settings.
2. Upload the setup EXE, bundle, App Installer file, and public certificate byte-for-byte.
3. Verify those four public URLs and headers.
4. Upload `release.json` last.
5. Run `node scripts/validate-offline-vault-windows-release.mjs --live`. This downloads all five public files, checks their exact hashes and sizes, validates the certificate and encoded URLs, and tests MIME types, content lengths, and byte ranges.
6. Only after the live validator passes, change `WINDOWS_SIDELOAD_ENABLED` to `true` in `/offline-vault/releases.js`.
7. Deploy the website and verify both `/offline-vault/` and `/downloads/` activate all links.

## User installation flow

1. Download and run `OfflineVaultCompanion-Setup-1.0.1.exe` from `downloads.greenvital.app`.
2. If SmartScreen appears, choose More info, then Run anyway.
3. Approve the UAC prompt.
4. Setup installs the embedded GreenVital public certificate and app, then launches the companion.

For manual installation, download `GreenVital-OfflineVault.cer`, confirm SHA-1 thumbprint `FC677345547ACF903AC8ABBEEEBD79A30318889C`, install it into Local Machine Trusted People, and then open `OfflineVaultCompanion.appinstaller`. The direct bundle SHA-256 is `0d6cd33c40f9e837e2fa23ef3f81dd03c31c032a1e0b379f0d2e10ae9699080b`.

Installing a certificate in Local Machine Trusted People affects the computer's trust configuration and normally requires administrator approval. Users should remove the certificate if they no longer want to trust GreenVital sideload packages.

No private signing material is published or required by the website. This release distributes only the already-verified public certificate asset.
