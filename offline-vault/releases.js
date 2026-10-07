(() => {
  // Signed Windows artifacts stay off GitHub Pages so their required headers can be controlled.
  const WINDOWS_RELEASE_ORIGIN = "https://downloads.greenvital.app";
  const WINDOWS_RELEASE_URL = `${WINDOWS_RELEASE_ORIGIN}/offline-vault/windows/release.json`;
  const statusLabels = {
    "coming-soon": "Coming soon",
    available: "Available"
  };

  function isExpectedDownloadUrl(value, fileName) {
    if (typeof value !== "string") {
      return false;
    }

    try {
      const url = new URL(value);
      const actualFileName = decodeURIComponent(url.pathname.split("/").pop());

      return url.origin === WINDOWS_RELEASE_ORIGIN && actualFileName === fileName;
    } catch {
      return false;
    }
  }

  function isValidWindowsRelease(release) {
    if (!release || typeof release !== "object") {
      return false;
    }

    const versionIsValid = typeof release.version === "string" && release.version.trim().length > 0;
    const minimumVersionIsValid =
      typeof release.minimumWindowsVersion === "string" &&
      release.minimumWindowsVersion.trim().length > 0;
    const architecturesAreValid =
      Array.isArray(release.architectures) &&
      release.architectures.length > 0 &&
      new Set(release.architectures).size === release.architectures.length &&
      release.architectures.every((architecture) => ["x64", "arm64"].includes(architecture));
    const checksumIsValid = typeof release.sha256 === "string" && /^[a-f0-9]{64}$/.test(release.sha256);
    const sizeIsValid = Number.isSafeInteger(release.sizeBytes) && release.sizeBytes > 0;
    const releaseDateIsValid =
      typeof release.releasedAt === "string" &&
      release.releasedAt.endsWith("Z") &&
      !Number.isNaN(Date.parse(release.releasedAt));
    const bundleName = versionIsValid
      ? `OfflineVaultCompanion-${release.version}.msixbundle`
      : "";

    return (
      versionIsValid &&
      minimumVersionIsValid &&
      architecturesAreValid &&
      checksumIsValid &&
      sizeIsValid &&
      releaseDateIsValid &&
      isExpectedDownloadUrl(release.msixBundleUrl, bundleName) &&
      isExpectedDownloadUrl(release.appInstallerUrl, "OfflineVaultCompanion.appinstaller")
    );
  }

  function formatBytes(bytes) {
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1000 && unitIndex < units.length - 1) {
      value /= 1000;
      unitIndex += 1;
    }

    const digits = value >= 100 || unitIndex === 0 ? 0 : 1;
    return `${value.toFixed(digits)} ${units[unitIndex]}`;
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
      const card = document.querySelector('[data-release-platform="macos"]');

      if (card && manifest.macos) {
        updateReleaseCard(card, manifest.macos);
      }
    })
    .catch(() => {
      // The static fallback remains accurate if the release manifest cannot load.
    });

  fetch(WINDOWS_RELEASE_URL, { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Windows release unavailable");
      }

      return response.json();
    })
    .then((release) => {
      if (!isValidWindowsRelease(release)) {
        return;
      }

      const card = document.querySelector('[data-release-platform="windows"]');

      if (!card) {
        return;
      }

      updateReleaseCard(card, {
        status: "available",
        version: release.version,
        minimumWindowsVersion: release.minimumWindowsVersion,
        architectures: release.architectures.join(" / "),
        msixBundleUrl: release.msixBundleUrl,
        appInstallerUrl: release.appInstallerUrl,
        sha256: release.sha256,
        fileSize: formatBytes(release.sizeBytes),
        releaseDate: formatReleaseDate(release.releasedAt)
      });
    })
    .catch(() => {
      // Windows downloads stay disabled until a complete signed release is published.
    });
})();
