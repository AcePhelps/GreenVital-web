const yearTargets = document.querySelectorAll("#current-year");

yearTargets.forEach((target) => {
  target.textContent = new Date().getFullYear();
});
