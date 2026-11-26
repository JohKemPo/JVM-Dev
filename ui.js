(function () {
  'use strict';

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  var el = document.getElementById('typed');
  if (!el) return;

  var lines = [
    'compilando ideias…',
    'preparando aulas…',
    'treinando modelos…',
    'revisando artigos…',
    'refatorando o futuro…',
    'deploy em breve.'
  ];

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = lines[lines.length - 1];
    return;
  }

  var i = 0, n = 0, deleting = false;

  function tick() {
    var line = lines[i];
    if (!deleting) {
      n++;
      el.textContent = line.slice(0, n);
      if (n === line.length) { deleting = true; return setTimeout(tick, 1700); }
      return setTimeout(tick, 38 + Math.random() * 50);
    }
    n--;
    el.textContent = line.slice(0, n);
    if (n === 0) { deleting = false; i = (i + 1) % lines.length; return setTimeout(tick, 350); }
    setTimeout(tick, 18);
  }

  setTimeout(function () { el.textContent = ''; tick(); }, 1600);
})();
