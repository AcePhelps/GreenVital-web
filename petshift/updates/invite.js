(() => {
  const match = /^#\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/([A-Za-z0-9_-]{43})$/i.exec(location.hash);
  if (!match) return;
  const [, business, invite] = match;
  document.getElementById('instructions').textContent = 'Opening your sitter’s invitation…';
  const form = document.createElement('form');
  form.method = 'post';
  form.action = 'https://petshift-dev-texting-consent.phone-lab-access.workers.dev/public/' + business + '/opt-in';
  for (const [name, value] of Object.entries({ intent: 'view', invite })) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
})();
