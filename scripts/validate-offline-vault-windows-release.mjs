#!/usr/bin/env node

import { createHash, X509Certificate } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WINDOWS_ORIGIN = "https://downloads.greenvital.app";
const WINDOWS_PATH = "/offline-vault/windows/";
const EXPECTED_CERTIFICATE_SHA1 = "FC677345547ACF903AC8ABBEEEBD79A30318889C";
const ASSETS = {
  "OfflineVaultCompanion-1.0.0.msixbundle": {
    contentType: "application/msixbundle",
    sha256: "81b1dc004993fffe56ab9ba75cd26991df1468a9d97fa1965a6af03921540a5e",
    size: 125803957,
    rangeRequired: true
  },
  "OfflineVaultCompanion.appinstaller": {
    contentType: "application/appinstaller",
    sha256: "3049f0a4c85bd83d186ddcf3f011fb13c44a38ef6bb18a0c5ea7cb688c986dfa",
    size: 662
  },
  "GreenVital-OfflineVault.cer": {
    contentType: "application/x-x509-ca-cert",
    sha256: "e452a048c253ee0d1f6ac45b8b0dc1350e9a3dccf946a240bf237f27dcb68484",
    size: 1022
  },
  "release.json": {
    contentType: "application/json",
    sha256: "57f89a583f88f050b7da1f14b74c7a68e2fb281b434ff40b3d8e959f8f8552b5",
    size: 514
  }
};

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function assetUrl(fileName) {
  return `${WINDOWS_ORIGIN}${WINDOWS_PATH}${fileName}`;
}

function validateReleaseJson(buffer) {
  const release = JSON.parse(buffer.toString("utf8"));

  assert(release.version === "1.0.0", "release version must be 1.0.0");
  assert(release.minimumWindowsVersion === "10.0.17763.0", "minimum Windows version changed");
  assert(
    Array.isArray(release.architectures) &&
      release.architectures.length === 2 &&
      release.architectures.includes("x64") &&
      release.architectures.includes("arm64"),
    "release architectures must be x64 and arm64"
  );
  assert(release.sha256 === ASSETS["OfflineVaultCompanion-1.0.0.msixbundle"].sha256, "bundle SHA-256 changed");
  assert(release.sizeBytes === ASSETS["OfflineVaultCompanion-1.0.0.msixbundle"].size, "bundle size changed");
  assert(
    release.msixBundleUrl === assetUrl("OfflineVaultCompanion-1.0.0.msixbundle"),
    "bundle URL changed"
  );
  assert(
    release.appInstallerUrl === assetUrl("OfflineVaultCompanion.appinstaller"),
    "App Installer URL changed"
  );
  assert(
    typeof release.releasedAt === "string" &&
      release.releasedAt.endsWith("Z") &&
      !Number.isNaN(Date.parse(release.releasedAt)),
    "release timestamp is invalid"
  );
}

function validateAppInstaller(buffer) {
  const value = buffer.toString("utf8");
  assert(value.includes('Publisher="CN=GreenVital"'), "App Installer publisher changed");
  assert(value.includes('Version="1.0.0.0"'), "App Installer version changed");
  assert(value.includes(assetUrl("OfflineVaultCompanion.appinstaller")), "App Installer self URL changed");
  assert(value.includes(assetUrl("OfflineVaultCompanion-1.0.0.msixbundle")), "App Installer bundle URL changed");
}

function validateCertificate(buffer) {
  const certificate = new X509Certificate(buffer);
  const fingerprint = certificate.fingerprint.replaceAll(":", "").toUpperCase();
  assert(certificate.subject === "CN=GreenVital", "certificate subject changed");
  assert(certificate.issuer === "CN=GreenVital", "certificate is no longer the expected self-signed certificate");
  assert(fingerprint === EXPECTED_CERTIFICATE_SHA1, `certificate SHA-1 changed to ${fingerprint}`);
}

function validateAsset(fileName, buffer) {
  const expected = ASSETS[fileName];
  assert(buffer.byteLength === expected.size, `${fileName} size changed to ${buffer.byteLength}`);
  assert(sha256(buffer) === expected.sha256, `${fileName} SHA-256 changed`);

  if (fileName === "release.json") {
    validateReleaseJson(buffer);
  } else if (fileName === "OfflineVaultCompanion.appinstaller") {
    validateAppInstaller(buffer);
  } else if (fileName === "GreenVital-OfflineVault.cer") {
    validateCertificate(buffer);
  }
}

async function validateLocalAssets(directory) {
  for (const fileName of Object.keys(ASSETS)) {
    const buffer = await readFile(resolve(directory, fileName));
    validateAsset(fileName, buffer);
  }

  console.log("All four Offline Vault sideload assets match the verified draft release byte-for-byte.");
}

async function fetchWithoutRedirect(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "manual",
    ...options
  });
  assert(response.status >= 200 && response.status < 300, `${url} returned HTTP ${response.status}`);
  assert(!response.redirected && response.status < 300, `${url} redirected`);
  return response;
}

function validateHeaders(response, fileName, expectedLength) {
  const expected = ASSETS[fileName];
  const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
  const contentLength = Number(response.headers.get("content-length"));

  assert(contentType === expected.contentType, `${fileName} has Content-Type ${contentType || "missing"}`);
  assert(contentLength === expectedLength, `${fileName} has Content-Length ${contentLength}`);
}

async function downloadLiveAsset(fileName) {
  const response = await fetchWithoutRedirect(assetUrl(fileName));
  validateHeaders(response, fileName, ASSETS[fileName].size);
  const buffer = Buffer.from(await response.arrayBuffer());
  validateAsset(fileName, buffer);
}

async function validateLiveRelease() {
  for (const fileName of Object.keys(ASSETS)) {
    await downloadLiveAsset(fileName);
  }

  const rangeResponse = await fetchWithoutRedirect(assetUrl("OfflineVaultCompanion-1.0.0.msixbundle"), {
    headers: { Range: "bytes=0-0" }
  });
  assert(rangeResponse.status === 206, `bundle range request returned HTTP ${rangeResponse.status}`);
  validateHeaders(rangeResponse, "OfflineVaultCompanion-1.0.0.msixbundle", 1);
  assert(
    rangeResponse.headers.get("content-range") === "bytes 0-0/125803957",
    "bundle Content-Range is invalid"
  );

  console.log("Live sideload release passed HTTPS, MIME, length, range, and byte-for-byte checks.");
}

async function validateWebsiteGate() {
  const script = await readFile(resolve(repositoryRoot, "offline-vault/releases.js"), "utf8");
  assert(
    script.includes("const WINDOWS_SIDELOAD_ENABLED = true;"),
    "Windows sideload controls are not enabled"
  );
  assert(script.includes(ASSETS["OfflineVaultCompanion-1.0.0.msixbundle"].sha256), "website bundle SHA-256 changed");
  assert(script.includes(EXPECTED_CERTIFICATE_SHA1), "website certificate thumbprint changed");
  assert(script.includes(ASSETS["GreenVital-OfflineVault.cer"].sha256.toUpperCase()), "website certificate SHA-256 changed");
  console.log("Website sideload controls are enabled with the verified release fingerprints pinned.");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await validateWebsiteGate();
    return;
  }

  if (args.length === 2 && args[0] === "--assets") {
    await validateLocalAssets(resolve(args[1]));
    return;
  }

  if (args.length === 1 && args[0] === "--live") {
    await validateLiveRelease();
    return;
  }

  fail("usage: validate-offline-vault-windows-release.mjs [--assets DIRECTORY | --live]");
}

main().catch((error) => {
  const causeCode = error.cause && typeof error.cause === "object" ? error.cause.code : null;
  const detail = causeCode ? `${error.message} (${causeCode})` : error.message;
  console.error(`Offline Vault Windows release validation failed: ${detail}`);
  process.exitCode = 1;
});
