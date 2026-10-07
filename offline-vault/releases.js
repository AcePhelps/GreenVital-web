(() => {
  // Flip only after the live validator downloads every file and confirms the bundle SHA-256.
  const WINDOWS_SIDELOAD_ENABLED = false;
  const WINDOWS_ORIGIN = "https://downloads.greenvital.app";
  const WINDOWS_PATH = "/offline-vault/windows/";
  const WINDOWS_RELEASE_URL = `${WINDOWS_ORIGIN}${WINDOWS_PATH}release.json`;
  const WINDOWS_CERTIFICATE_URL = `${WINDOWS_ORIGIN}${WINDOWS_PATH}GreenVital-OfflineVault.cer`;
  const EXPECTED_BUNDLE_SHA256 = "81b1dc004993fffe56ab9ba75cd26991df1468a9d97fa1965a6af03921540a5e";
  const EXPECTED_CERTIFICATE_SHA1 = "FC677345547ACF903AC8ABBEEEBD79A30318889C";
  const EXPECTED_BUNDLE_SIZE = 125803957;
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

  function verifyFile(url, expectedType, expectedSize, rangeRequired = false) {
    return fetch(url, {
      method: "HEAD",
      cache: "no-store",
      redirect: "error"
    }).then((response) => {
      const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
      const contentLength = Number(response.headers.get("content-length"));
      const rangeIsValid = !rangeRequired || response.headers.get("accept-ranges") === "bytes";

      return response.ok && contentType === expectedType && contentLength === expectedSize && rangeIsValid;
    });
  }

  function verifyHostedFiles(release) {
    return Promise.all([
      verifyFile(WINDOWS_CERTIFICATE_URL, "application/x-x509-ca-cert", 1022),
      verifyFile(release.appInstallerUrl, "application/appinstaller", 662),
      verifyFile(release.msixBundleUrl, "application/msixbundle", EXPECTED_BUNDLE_SIZE, true)
    ]).then((checks) => checks.every(Boolean));
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

  fetch(WINDOWS_RELEASE_URL, { cache: "no-store", redirect: "error" })
    .then((response) => {
      if (!response.ok || !response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
        throw new Error("Windows release manifest unavailable");
      }

      return response.json();
    })
    .then(async (release) => {
      if (!isValidWindowsRelease(release) || !(await verifyHostedFiles(release))) {
        return;
      }

      const displayRelease = {
        ...release,
        status: "self-signed-sideload",
        certificateUrl: WINDOWS_CERTIFICATE_URL,
        certificateSha1: EXPECTED_CERTIFICATE_SHA1,
        architectures: release.architectures.join(" / "),
        fileSize: formatBytes(release.sizeBytes),
        releaseDate: formatReleaseDate(release.releasedAt)
      };

      document.querySelectorAll('[data-release-platform="windows"]').forEach((card) => {
        updateReleaseCard(card, displayRelease);
      });
    })
    .catch(() => {
      // Sideload controls remain disabled unless every safety check passes.
    });
})();
