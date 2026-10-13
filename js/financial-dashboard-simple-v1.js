/* MOLMS Financial Dashboard Simple Presentation V1
 * Presentation only: existing calculations, source data, and workflows remain authoritative.
 * Hides specific dashboard summary/register cards only; never hides the page or scroll container.
 */
(function () {
  'use strict';
  if (window.MOLMSFinancialDashboardSimpleV1) return;
  window.MOLMSFinancialDashboardSimpleV1 = { version: 2, applied: false };
  const styleId = 'molms-financial-dashboard-simple-v1-style';

  function installStyle() {
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      #page-findash #fdKpiRow { grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;padding:14px 20px!important; }
      #page-findash #fdKpiRow>* { min-width:0; }
      #page-findash #fdKpiRow>div:nth-child(3) { display:block!important; }
      #page-findash>div[style*="overflow-y:auto"] { padding:16px 20px!important; }
      #page-findash .fd-simple-quick-actions { display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:12px; }
      #page-findash .fd-simple-quick-actions strong { font-size:11px;color:var(--navy);margin-right:4px; }
      #page-findash .fd-simple-quick-actions button { font-size:12px!important; }
      @media(max-width:760px){#page-findash #fdKpiRow{grid-template-columns:repeat(2,minmax(0,1fr))!important;padding:12px!important;gap:8px!important}#page-findash>div[style*="overflow-y:auto"]{padding:12px!important}}
      @media(max-width:380px){#page-findash #fdKpiRow{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function dashboardCardFor(el, scroll) {
    let node = el;
    while (node && node.parentElement && node.parentElement !== scroll) {
      if (node.matches && node.matches('div') &&
          /border-radius:\s*12px/i.test(node.getAttribute('style') || '') &&
          /background:\s*#fff/i.test(node.getAttribute('style') || '')) return node;
      node = node.parentElement;
    }
    return node && node.parentElement === scroll ? node : null;
  }

  function apply() {
    const page = document.getElementById('page-findash');
    if (!page) return;
    installStyle();
    const scroll = Array.from(page.children).find(el => /overflow-y:\s*auto/i.test(el.getAttribute('style') || ''));
    if (!scroll) return;

    // Keep existing manual-entry actions available after moving copies into Quick Actions.
    const manualBody = page.querySelector('#fdManualBody');
    const manualCard = manualBody && dashboardCardFor(manualBody, scroll);
    if (manualCard && !page.querySelector('.fd-simple-quick-actions')) {
      const sourceButtons = Array.from(manualCard.querySelectorAll('button[onclick*="fdOpenManualModal"]'));
      if (sourceButtons.length) {
        const actions = document.createElement('div');
        actions.className = 'fd-simple-quick-actions';
        actions.innerHTML = '<strong>QUICK ACTIONS</strong>';
        sourceButtons.forEach(button => {
          const copy = button.cloneNode(true);
          copy.removeAttribute('id');
          actions.appendChild(copy);
        });
        const obligations = page.querySelector('#fdPriorityRowV7') || page.querySelector('#fdMonthlyObligations');
        const anchor = obligations ? (obligations.closest('#fdPriorityRowV7') || obligations) : page.querySelector('#fdKpiRow');
        if (anchor && anchor.parentElement === scroll) anchor.insertAdjacentElement('afterend', actions);
        else scroll.insertBefore(actions, scroll.firstChild);
      }
    }

    // Remove dense tables/analytics from the landing view only. Their modules and
    // the underlying elements/data remain in the document for existing workflows.
    const hideIds = ['fdRegBody','fdManualBody','fdRevByType','fdExpByCategory','fdExpenseBody','fdBudgetBody','fdTopClients','fdMatterLeaderboard','fdTimeline'];
    hideIds.forEach(id => {
      const el = page.querySelector('#' + id);
      if (!el) return;
      const card = dashboardCardFor(el, scroll);
      if (card && card !== scroll && card !== page.querySelector('#fdPriorityRowV7')) card.style.display = 'none';
    });

    // Remove just the separate Practice Performance card, not the surrounding row
    // that may contain other information.
    const practice = page.querySelector('#fdPracticePerformance');
    if (practice) {
      const card = dashboardCardFor(practice, scroll);
      if (card && card !== scroll) card.style.display = 'none';
    }
    window.MOLMSFinancialDashboardSimpleV1.applied = true;
  }

  function start() {
    apply();
    const page = document.getElementById('page-findash');
    if (!page || window.MOLMSFinancialDashboardSimpleV1.observer) return;
    const observer = new MutationObserver(() => apply());
    observer.observe(page, { childList:true, subtree:true });
    window.MOLMSFinancialDashboardSimpleV1.observer = observer;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
  window.addEventListener('load', start, { once:true });
})();