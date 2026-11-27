/* Progressive navigation and previews. Page content remains usable without JS. */
(() => {
  const header = document.querySelector('.gv-header');
  const navigation = header?.querySelector('.gv-nav');
  if (navigation) {
    const toggle = document.createElement('button');
    toggle.className = 'gv-menu-toggle';
    toggle.type = 'button';
    toggle.textContent = 'Menu';
    navigation.id = 'site-navigation';
    toggle.setAttribute('aria-controls', navigation.id);
    toggle.setAttribute('aria-expanded', 'false');
    header.classList.add('gv-nav-enhanced');
    navigation.before(toggle);
    const close = () => {
      toggle.setAttribute('aria-expanded', 'false');
      header.classList.remove('gv-menu-open');
    };
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      header.classList.toggle('gv-menu-open', open);
    });
    header.addEventListener('keydown', event => {
      if (event.key === 'Escape' && header.classList.contains('gv-menu-open')) {
        close();
        toggle.focus();
      }
    });
    navigation.addEventListener('click', event => {
      if (event.target.closest('a')) close();
    });
    document.addEventListener('click', event => {
      if (!header.contains(event.target)) close();
    });
    matchMedia('(min-width: 721px)').addEventListener('change', close);
  }

  document.querySelectorAll('[data-app-preview]').forEach(preview => {
    const tabs = [...preview.querySelectorAll('[role="tab"]')];
    const activate = tab => {
      tabs.forEach(item => {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
      });
    };
    preview.querySelector('[role="tablist"]').hidden = false;
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', event => {
        const directions = {ArrowRight: 1, ArrowLeft: -1};
        let next;
        if (event.key in directions) next = (index + directions[event.key] + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        activate(tabs[next]);
        tabs[next].focus();
      });
    });
  });

  const screenshots = document.querySelectorAll('.gv-detail-visual img, .gv-screen-grid img');
  if (!screenshots.length || typeof HTMLDialogElement === 'undefined') return;
  const dialog = document.createElement('dialog');
  dialog.className = 'gv-image-dialog';
  dialog.setAttribute('aria-label', 'App screenshot');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'gv-image-close';
  close.textContent = 'Close preview';
  const image = document.createElement('img');
  dialog.append(close, image);
  document.body.append(dialog);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.classList.remove('gv-image-viewing'));
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  screenshots.forEach(screenshot => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gv-image-open';
    button.setAttribute('aria-label', 'Enlarge ' + screenshot.alt);
    screenshot.before(button);
    button.append(screenshot);
    button.addEventListener('click', () => {
      image.src = screenshot.dataset.fullSrc || screenshot.currentSrc || screenshot.src;
      image.alt = screenshot.alt;
      document.body.classList.add('gv-image-viewing');
      dialog.showModal();
    });
  });
})();
