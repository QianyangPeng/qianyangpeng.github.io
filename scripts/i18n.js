(function () {
  var KEY = 'qp-lang';
  var SUPPORTED = ['en', 'zh'];

  function currentLang() {
    return document.documentElement.lang || 'en';
  }

  function setLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = 'en';
    document.documentElement.lang = lang;
    try { localStorage.setItem(KEY, lang); } catch (e) { /* storage blocked */ }
    var btn = document.getElementById('lang-toggle');
    if (btn) {
      btn.setAttribute('aria-label',
        lang === 'en' ? 'Switch to Chinese' : 'Switch to English');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    setLang(currentLang());
    var btn = document.getElementById('lang-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      setLang(currentLang() === 'en' ? 'zh' : 'en');
    });
  });
})();
