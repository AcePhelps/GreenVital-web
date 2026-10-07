(() => {
  const WINDOWS_DOWNLOAD_PREFIX = "/downloads/offline-vault/windows/";
  const statusLabels = {
    "coming-soon": "Coming soon",
    available: "Available"
  };

  function isExpectedWindowsUrl(value, version) {
    if (typeof value !== "string") {
      return false;
    }

    return value === `${WINDOWS_DOWNLOAD_PREFIX}OfflineVaultCompanion-${version}.zip`;
  }

  function isValidWindowsRelease(release) {
    if (!release || typeof release !== "object" || release.status !== "available") {
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
      typeof release.releaseDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(release.releaseDate) &&
      !Number.isNaN(Date.parse(`${release.releaseDate}T00:00:00Z`));

    return (
      versionIsValid &&
      minimumVersionIsValid &&
      architecturesAreValid &&
      checksumIsValid &&
      sizeIsValid &&
      releaseDateIsValid &&
      isExpectedWindowsUrl(release.downloadUrl, release.version)
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
    }).format(new Date(`${value}T00:00:00Z`));
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
      link.download = "";
      link.textContent = link.dataset.readyLabel;
      link.removeAttribute("aria-disabled");
      link.classList.remove("button-disabled");
      link.classList.add("button-active");
    });
  }

  function releaseFileIsLive(release) {
    return fetch(release.downloadUrl, { method: "HEAD", cache: "no-store" })
      .then((response) => {
        const contentLength = Number(response.headers.get("content-length"));
        return response.ok && !response.redirected && contentLength === release.sizeBytes;
      })
      .catch(() => false);
  }

  fetch("/offline-vault/releases.json", { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Release manifest unavailable");
      }

      return response.json();
    })
    .then(async (manifest) => {
      const macCard = document.querySelector('[data-release-platform="macos"]');

      if (macCard && manifest.macos) {
        updateReleaseCard(macCard, manifest.macos);
      }

      if (!isValidWindowsRelease(manifest.windows)) {
        return;
      }

      if (!(await releaseFileIsLive(manifest.windows))) {
        return;
      }

      const windowsCard = document.querySelector('[data-release-platform="windows"]');

      if (!windowsCard) {
        return;
      }

      updateReleaseCard(windowsCard, {
        ...manifest.windows,
        architectures: manifest.windows.architectures.join(" / "),
        fileSize: formatBytes(manifest.windows.sizeBytes),
        releaseDate: formatReleaseDate(manifest.windows.releaseDate)
      });
    })
    .catch(() => {
      // Static fallbacks remain accurate until a complete signed release is present.
    });
})();
