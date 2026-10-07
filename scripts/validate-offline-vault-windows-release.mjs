#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(repositoryRoot, "offline-vault/releases.json");
const downloadDirectory = resolve(repositoryRoot, "downloads/offline-vault/windows");
const MAX_GITHUB_FILE_SIZE = 100 * 1024 * 1024;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function validateComingSoon(release) {
  assert(release.status === "coming-soon", "windows status must be coming-soon or available");
  assert(release.version === null, "coming-soon version must be null");
  assert(release.minimumWindowsVersion === null, "coming-soon minimumWindowsVersion must be null");
  assert(Array.isArray(release.architectures) && release.architectures.length === 0, "coming-soon architectures must be empty");
  assert(release.downloadUrl === null, "coming-soon downloadUrl must be null");
  assert(release.sha256 === null, "coming-soon sha256 must be null");
  assert(release.sizeBytes === null, "coming-soon sizeBytes must be null");
  assert(release.releaseDate === null, "coming-soon releaseDate must be null");
}

function validateAvailable(release) {
  assert(
    typeof release.version === "string" && /^[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(release.version),
    "version must be a non-empty filename-safe string"
  );
  assert(
    typeof release.minimumWindowsVersion === "string" && release.minimumWindowsVersion.trim().length > 0,
    "minimumWindowsVersion must be a non-empty string"
  );
  assert(
    Array.isArray(release.architectures) &&
      release.architectures.length > 0 &&
      new Set(release.architectures).size === release.architectures.length &&
      release.architectures.every((value) => value === "x64" || value === "arm64"),
    "architectures must contain unique x64 and/or arm64 values"
  );
  assert(
    typeof release.sha256 === "string" && /^[a-f0-9]{64}$/.test(release.sha256),
    "sha256 must be 64 lowercase hexadecimal characters"
  );
  assert(Number.isSafeInteger(release.sizeBytes) && release.sizeBytes > 0, "sizeBytes must be a positive integer");
  assert(
    typeof release.releaseDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(release.releaseDate) &&
      !Number.isNaN(Date.parse(`${release.releaseDate}T00:00:00Z`)),
    "releaseDate must use YYYY-MM-DD"
  );

  const expectedUrl = `/downloads/offline-vault/windows/OfflineVaultCompanion-${release.version}.zip`;
  assert(release.downloadUrl === expectedUrl, `downloadUrl must be ${expectedUrl}`);
}

function calculateSha256(filePath) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

async function validateZip(release) {
  const filePath = resolve(repositoryRoot, `.${release.downloadUrl}`);
  assert(filePath.startsWith(`${downloadDirectory}/`), "downloadUrl escapes the Windows download directory");

  const file = await stat(filePath);
  assert(file.isFile(), "downloadUrl does not reference a file");
  assert(file.size === release.sizeBytes, `ZIP size ${file.size} does not match sizeBytes ${release.sizeBytes}`);
  assert(file.size <= MAX_GITHUB_FILE_SIZE, "ZIP exceeds GitHub's 100 MiB file limit");

  const checksum = await calculateSha256(filePath);
  assert(checksum === release.sha256, `ZIP SHA-256 ${checksum} does not match the manifest`);

  const { stdout } = await execFileAsync("unzip", ["-Z1", filePath], { maxBuffer: 1024 * 1024 });
  const entries = stdout.split(/\r?\n/).filter(Boolean);
  const bundles = entries.filter((entry) => entry.toLowerCase().endsWith(".msixbundle"));
  const forbidden = entries.filter((entry) => /(?:^|\/)[^/]+\.(?:pfx|p12|pem|key|appinstaller)$/i.test(entry));

  assert(entries.length > 0, "ZIP is empty");
  assert(entries.every((entry) => !entry.startsWith("/") && !entry.split("/").includes("..")), "ZIP contains an unsafe path");
  assert(bundles.length === 1, "ZIP must contain exactly one MSIX bundle");
  assert(forbidden.length === 0, `ZIP contains forbidden release files: ${forbidden.join(", ")}`);
}

async function ensureNoUnpublishedZip() {
  try {
    const entries = await readdir(downloadDirectory);
    const archives = entries.filter((entry) => entry.toLowerCase().endsWith(".zip"));
    assert(archives.length === 0, `coming-soon release must not publish ZIP files: ${archives.join(", ")}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const release = manifest.windows;

  assert(release && typeof release === "object" && !Array.isArray(release), "windows release entry is required");

  if (release.status === "available") {
    validateAvailable(release);
    await validateZip(release);
    console.log(`Offline Vault Windows ${release.version} manual download is valid.`);
    return;
  }

  validateComingSoon(release);
  await ensureNoUnpublishedZip();
  console.log("Offline Vault Windows manual download remains safely gated as coming soon.");
}

main().catch((error) => {
  console.error(`Offline Vault Windows release validation failed: ${error.message}`);
  process.exitCode = 1;
});
