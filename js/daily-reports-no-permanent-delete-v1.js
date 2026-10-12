/* MOLMS Daily Reports: remove the accidental permanent-delete control.
   Daily reports are retained for transparency/audit; this patch only hides the
   UI control in Daily Reports and does not alter report data or other modules. */
(function () {
  'use strict';
  const STYLE_ID = 'molmsDailyReportsNoPermanentDeleteStyleV1';
  function isDailyReportsView(doc) {
    const headings = Array.from(doc.querySelectorAll('h1,h2,h3,[role="heading"]'));
    return headings.some(el => /daily work reports|daily reports/i.test((el.textContent || '').trim()));
  }
  function removeControl(doc) {
    if (!doc || !doc.body || !isDailyReportsView(doc)) return;
    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = '[data-molms-daily-report-permanent-delete="hidden"]{display:none!important;visibility:hidden!important}';
      doc.head.appendChild(style);
    }
    const candidates = Array.from(doc.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]'));
    candidates.forEach(el => {
      const label = ((el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || '') + '').trim().replace(/\s+/g, ' ');
      if (/^permanently delete$/i.test(label)) {
        el.setAttribute('data-molms-daily-report-permanent-delete', 'hidden');
        const parent = el.parentElement;
        if (parent && parent.children.length === 1 && parent.tagName !== 'BODY') {
          // Hide only the button itself; preserve the surrounding filter layout.
          el.style.display = 'none';
        }
      }
    });
  }
  function init() {
    const doc = document;
    removeControl(doc);
    if (doc.body && !doc.body.__molmsDailyDeleteObserverV1) {
      const observer = new MutationObserver(() => removeControl(doc));
      observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
      doc.body.__molmsDailyDeleteObserverV1 = observer;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();