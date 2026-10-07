(() => {
  const statusLabels = {
    "coming-soon": "Coming soon",
    available: "Available"
  };

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
      document.querySelectorAll("[data-release-platform]").forEach((card) => {
        const release = manifest[card.dataset.releasePlatform];

        if (release) {
          updateReleaseCard(card, release);
        }
      });
    })
    .catch(() => {
      // The static fallback remains accurate if the release manifest cannot load.
    });
})();
