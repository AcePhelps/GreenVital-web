(() => {
  // This release is enabled only after every hosted file passes the repository validator.
  const WINDOWS_SIDELOAD_ENABLED = true;
  const WINDOWS_ORIGIN = "https://downloads.greenvital.app";
  const WINDOWS_PATH = "/offline-vault/windows/";
  const WINDOWS_RELEASE_URL = `${WINDOWS_ORIGIN}${WINDOWS_PATH}release.json`;
  const WINDOWS_CERTIFICATE_URL = `${WINDOWS_ORIGIN}${WINDOWS_PATH}GreenVital-OfflineVault.cer`;
  const EXPECTED_BUNDLE_SHA256 = "81b1dc004993fffe56ab9ba75cd26991df1468a9d97fa1965a6af03921540a5e";
  const EXPECTED_CERTIFICATE_SHA256 = "E452A048C253EE0D1F6AC45B8B0DC1350E9A3DCCF946A240BF237F27DCB68484";
  const EXPECTED_CERTIFICATE_SHA1 = "FC677345547ACF903AC8ABBEEEBD79A30318889C";
  const EXPECTED_BUNDLE_SIZE = 125803957;
  const WINDOWS_RELEASE = {
    version: "1.0.0",
    minimumWindowsVersion: "10.0.17763.0",
    architectures: ["x64", "arm64"],
    msixBundleUrl: `${WINDOWS_ORIGIN}${WINDOWS_PATH}OfflineVaultCompanion-1.0.0.msixbundle`,
    appInstallerUrl: `${WINDOWS_ORIGIN}${WINDOWS_PATH}OfflineVaultCompanion.appinstaller`,
    sha256: EXPECTED_BUNDLE_SHA256,
    sizeBytes: EXPECTED_BUNDLE_SIZE,
    releasedAt: "2026-10-07T21:32:42.9223050Z"
  };
  const statusLabels = {
    "coming-soon": "Coming soon",
    available: "Available",
    "self-signed-sideload": "Self-signed sideload"
  };

  function isExpectedUrl(value, fileName) {
    return value === `${WINDOWS_ORIGIN}${WINDOWS_PATH}${fileName}`;
  }

  function isValidWindowsRelease(release) {
    if (!release || typeof release !== "object") {
      return false;
    }

    const versionIsValid = release.version === "1.0.0";
    const minimumVersionIsValid = release.minimumWindowsVersion === "10.0.17763.0";
    const architecturesAreValid =
      Array.isArray(release.architectures) &&
      release.architectures.length === 2 &&
      release.architectures.includes("x64") &&
      release.architectures.includes("arm64");
    const releaseDateIsValid =
      typeof release.releasedAt === "string" &&
      release.releasedAt.endsWith("Z") &&
      !Number.isNaN(Date.parse(release.releasedAt));

    return (
      versionIsValid &&
      minimumVersionIsValid &&
      architecturesAreValid &&
      release.sha256 === EXPECTED_BUNDLE_SHA256 &&
      release.sizeBytes === EXPECTED_BUNDLE_SIZE &&
      releaseDateIsValid &&
      isExpectedUrl(release.msixBundleUrl, "OfflineVaultCompanion-1.0.0.msixbundle") &&
      isExpectedUrl(release.appInstallerUrl, "OfflineVaultCompanion.appinstaller")
    );
  }

  function formatBytes(bytes) {
    return `${(bytes / 1000000).toFixed(1)} MB`;
  }

  function formatReleaseDate(value) {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    }).format(new Date(value));
  }

  function updateReleaseCard(card, release) {
    card.querySelectorAll("[data-release-field]").forEach((field) => {
      const key = field.dataset.releaseField;
      const value = key === "status" ? statusLabels[release[key]] : release[key];

      if (value) {
        field.textContent = value;
      }
    });

    card.querySelectorAll("[data-release-link]").forEach((link) => {
      const url = release[link.dataset.releaseLink];

      if (!url) {
        return;
      }

      link.href = url;
      link.textContent = link.dataset.readyLabel;
      link.removeAttribute("aria-disabled");
      link.classList.remove("button-disabled");
      link.classList.add("button-active");
    });
  }

  fetch("/offline-vault/releases.json", { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Release manifest unavailable");
      }

      return response.json();
    })
    .then((manifest) => {
      const macCard = document.querySelector('[data-release-platform="macos"]');

      if (macCard && manifest.macos) {
        updateReleaseCard(macCard, manifest.macos);
      }
    })
    .catch(() => {
      // Static fallbacks remain accurate if the local manifest cannot load.
    });

  if (!WINDOWS_SIDELOAD_ENABLED) {
    return;
  }

  if (!isValidWindowsRelease(WINDOWS_RELEASE)) {
    return;
  }

  const displayRelease = {
    ...WINDOWS_RELEASE,
    status: "self-signed-sideload",
    certificateUrl: WINDOWS_CERTIFICATE_URL,
    certificateSha1: EXPECTED_CERTIFICATE_SHA1,
    certificateSha256: EXPECTED_CERTIFICATE_SHA256,
    releaseManifestUrl: WINDOWS_RELEASE_URL,
    architectures: WINDOWS_RELEASE.architectures.join(" / "),
    fileSize: formatBytes(WINDOWS_RELEASE.sizeBytes),
    releaseDate: formatReleaseDate(WINDOWS_RELEASE.releasedAt)
  };

  document.querySelectorAll('[data-release-platform="windows"]').forEach((card) => {
    updateReleaseCard(card, displayRelease);
  });
})();
