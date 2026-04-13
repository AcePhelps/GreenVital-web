const yearTargets = document.querySelectorAll("#current-year");

yearTargets.forEach((target) => {
  target.textContent = new Date().getFullYear();
});

const animatedElements = document.querySelectorAll(".fade-up, .image-reveal");

if (animatedElements.length > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 },
  );

  animatedElements.forEach((element) => observer.observe(element));
}
