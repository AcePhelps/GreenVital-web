#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const RELEASE_ORIGIN = "https://downloads.greenvital.app";
const RELEASE_PATH = "/offline-vault/windows/release.json";
const RELEASE_URL = `${RELEASE_ORIGIN}${RELEASE_PATH}`;
const SITE_ORIGIN = "https://greenvital.app";
const REQUIRED_KEYS = [
  "version",
  "minimumWindowsVersion",
  "architectures",
  "msixBundleUrl",
  "appInstallerUrl",
  "sha256",
  "sizeBytes",
  "releasedAt"
];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function parseMaxAge(cacheControl) {
  const match = /(?:^|,)\s*max-age=(\d+)\s*(?:,|$)/i.exec(cacheControl || "");
  return match ? Number(match[1]) : null;
}

function validateDownloadUrl(value, expectedFileName, fieldName) {
  assert(typeof value === "string", `${fieldName} must be a string`);

  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${fieldName} must be an absolute URL`);
  }

  assert(url.protocol === "https:", `${fieldName} must use HTTPS`);
  assert(url.origin === RELEASE_ORIGIN, `${fieldName} must use ${RELEASE_ORIGIN}`);
  assert(
    url.pathname === `/offline-vault/windows/${expectedFileName}`,
    `${fieldName} must end with /offline-vault/windows/${expectedFileName}`
  );
  assert(!url.search && !url.hash, `${fieldName} must not contain a query string or fragment`);
}

function validateManifest(manifest) {
  assert(manifest && typeof manifest === "object" && !Array.isArray(manifest), "manifest must be an object");

  const actualKeys = Object.keys(manifest).sort();
  const expectedKeys = [...REQUIRED_KEYS].sort();
  assert(
    JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
    `manifest keys must be exactly: ${REQUIRED_KEYS.join(", ")}`
  );

  assert(
    typeof manifest.version === "string" && /^[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(manifest.version),
    "version must be a non-empty filename-safe string"
  );
  assert(
    typeof manifest.minimumWindowsVersion === "string" && manifest.minimumWindowsVersion.trim().length > 0,
    "minimumWindowsVersion must be a non-empty string"
  );
  assert(
    Array.isArray(manifest.architectures) &&
      manifest.architectures.length > 0 &&
      new Set(manifest.architectures).size === manifest.architectures.length &&
      manifest.architectures.every((value) => value === "x64" || value === "arm64"),
    "architectures must contain unique x64 and/or arm64 values"
  );
  assert(
    typeof manifest.sha256 === "string" && /^[a-f0-9]{64}$/.test(manifest.sha256),
    "sha256 must be 64 lowercase hexadecimal characters"
  );
  assert(Number.isSafeInteger(manifest.sizeBytes) && manifest.sizeBytes > 0, "sizeBytes must be a positive integer");
  assert(
    typeof manifest.releasedAt === "string" &&
      manifest.releasedAt.endsWith("Z") &&
      !Number.isNaN(Date.parse(manifest.releasedAt)),
    "releasedAt must be a valid ISO-8601 UTC timestamp"
  );

  validateDownloadUrl(
    manifest.msixBundleUrl,
    `OfflineVaultCompanion-${manifest.version}.msixbundle`,
    "msixBundleUrl"
  );
  validateDownloadUrl(
    manifest.appInstallerUrl,
    "OfflineVaultCompanion.appinstaller",
    "appInstallerUrl"
  );
}

function assertNoRedirect(response, label) {
  assert(response.status >= 200 && response.status < 300, `${label} returned HTTP ${response.status}`);
  assert(!response.redirected, `${label} redirected`);
}

function assertContentType(response, expected, label) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  assert(contentType.split(";", 1)[0].trim() === expected, `${label} has Content-Type ${contentType || "missing"}`);
}

function assertContentLength(response, label, expected = null) {
  const raw = response.headers.get("content-length");
  const value = raw === null ? NaN : Number(raw);
  assert(Number.isSafeInteger(value) && value > 0, `${label} is missing a valid Content-Length`);
  if (expected !== null) {
    assert(value === expected, `${label} Content-Length ${value} does not match sizeBytes ${expected}`);
  }
}

function assertCors(response, label) {
  const origin = response.headers.get("access-control-allow-origin");
  assert(origin === SITE_ORIGIN, `${label} must allow CORS from ${SITE_ORIGIN}`);
}

function assertShortCache(response, label, maximumAge) {
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = parseMaxAge(cacheControl);
  const explicitlyRevalidated = /(?:^|,)\s*(?:no-cache|no-store)\s*(?:,|$)/i.test(cacheControl);
  assert(
    explicitlyRevalidated || (maxAge !== null && maxAge <= maximumAge),
    `${label} must use no-cache/no-store or max-age no greater than ${maximumAge}`
  );
}

async function fetchChecked(url, options, label) {
  const response = await fetch(url, { redirect: "manual", ...options });
  assertNoRedirect(response, label);
  return response;
}

async function loadLocalManifest(filePath) {
  const text = await readFile(resolve(filePath), "utf8");
  return JSON.parse(text);
}

async function loadLiveManifest() {
  const response = await fetchChecked(
    RELEASE_URL,
    { headers: { Origin: SITE_ORIGIN } },
    "release.json GET"
  );
  assertContentType(response, "application/json", "release.json GET");
  assertContentLength(response, "release.json GET");
  assertCors(response, "release.json GET");
  assertShortCache(response, "release.json GET", 60);
  return response.json();
}

async function validateLiveHeaders(manifest) {
  const releaseHead = await fetchChecked(
    RELEASE_URL,
    { method: "HEAD", headers: { Origin: SITE_ORIGIN } },
    "release.json HEAD"
  );
  assertContentType(releaseHead, "application/json", "release.json HEAD");
  assertContentLength(releaseHead, "release.json HEAD");
  assertCors(releaseHead, "release.json HEAD");
  assertShortCache(releaseHead, "release.json HEAD", 60);

  const bundleHead = await fetchChecked(
    manifest.msixBundleUrl,
    { method: "HEAD", headers: { Origin: SITE_ORIGIN } },
    "MSIX bundle HEAD"
  );
  assertContentType(bundleHead, "application/msixbundle", "MSIX bundle HEAD");
  assertContentLength(bundleHead, "MSIX bundle HEAD", manifest.sizeBytes);
  assertCors(bundleHead, "MSIX bundle HEAD");
  const bundleCache = bundleHead.headers.get("cache-control") || "";
  assert(/(?:^|,)\s*immutable\s*(?:,|$)/i.test(bundleCache), "MSIX bundle must use immutable caching");
  assert((parseMaxAge(bundleCache) || 0) >= 31536000, "MSIX bundle max-age must be at least one year");
  assert(!bundleHead.headers.get("content-encoding"), "MSIX bundle must not be content-encoded");

  const rangeResponse = await fetchChecked(
    manifest.msixBundleUrl,
    { headers: { Origin: SITE_ORIGIN, Range: "bytes=0-0" } },
    "MSIX bundle range GET"
  );
  assert(rangeResponse.status === 206, `MSIX bundle range GET returned HTTP ${rangeResponse.status}, expected 206`);
  assert(rangeResponse.headers.get("accept-ranges") === "bytes", "MSIX bundle must advertise Accept-Ranges: bytes");
  assert(/^bytes 0-0\/\d+$/.test(rangeResponse.headers.get("content-range") || ""), "MSIX bundle has an invalid Content-Range");
  assertContentLength(rangeResponse, "MSIX bundle range GET", 1);

  const installerHead = await fetchChecked(
    manifest.appInstallerUrl,
    { method: "HEAD", headers: { Origin: SITE_ORIGIN } },
    "App Installer HEAD"
  );
  assertContentType(installerHead, "application/appinstaller", "App Installer HEAD");
  assertContentLength(installerHead, "App Installer HEAD");
  assertCors(installerHead, "App Installer HEAD");
  assertShortCache(installerHead, "App Installer HEAD", 300);

  const installerGet = await fetchChecked(
    manifest.appInstallerUrl,
    { headers: { Origin: SITE_ORIGIN } },
    "App Installer GET"
  );
  assertContentType(installerGet, "application/appinstaller", "App Installer GET");
  assertContentLength(installerGet, "App Installer GET");
  assertCors(installerGet, "App Installer GET");
  const installerText = await installerGet.text();
  assert(
    installerText.includes(manifest.msixBundleUrl),
    "App Installer does not reference the manifest MSIX bundle URL"
  );
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.length === 1 && args[0] === "--live";

  if (!live && args.length !== 1) {
    console.error("Usage:");
    console.error("  node scripts/validate-offline-vault-windows-release.mjs /path/to/release.json");
    console.error("  node scripts/validate-offline-vault-windows-release.mjs --live");
    process.exitCode = 2;
    return;
  }

  const manifest = live ? await loadLiveManifest() : await loadLocalManifest(args[0]);
  validateManifest(manifest);

  if (live) {
    await validateLiveHeaders(manifest);
    console.log(`Live Offline Vault Windows release passed: ${RELEASE_URL}`);
  } else {
    console.log(`Offline Vault Windows release manifest is valid: ${resolve(args[0])}`);
  }
}

main().catch((error) => {
  const causeCode = error.cause && typeof error.cause === "object" ? error.cause.code : null;
  const detail = causeCode ? `${error.message} (${causeCode})` : error.message;
  console.error(`Offline Vault Windows release validation failed: ${detail}`);
  process.exitCode = 1;
});
