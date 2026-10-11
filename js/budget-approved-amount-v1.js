/* MOLMS Approved Budget Amount V1
 * Applies to legacy, current and future budget documents.
 * The headline amount is based only on approved line items.
 */
(function () {
  'use strict';
  if (window.__molmsApprovedBudgetAmountV1) return;
  window.__molmsApprovedBudgetAmountV1 = true;

  const PANEL_ID = 'molms-approved-budget-amount-v1';
  const money = value => 'TZS ' + Number(value || 0).toLocaleString('en-TZ', {maximumFractionDigits:2, minimumFractionDigits:0});
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const norm = value => String(value || '').toLowerCase().replace(/[\\s_-]+/g, ' ').trim();
  function getLines() {
    if (Array.isArray(window._bdLines)) return window._bdLines;
    try { if (typeof _bdLines !== 'undefined' && Array.isArray(_bdLines)) return _bdLines; } catch (_) {}
    return [];
  }
  function activeId() {
    const panel = document.getElementById('bdPanelActions');
    return (panel && panel.dataset.bdBudgetId) || window._bdActiveId || null;
  }
  function totals() {
    const lines = getLines();
    return lines.reduce((sum, line) => {
      const amount = num(line.requested_amount);
      const status = norm(line.status);
      if (status === 'approved') sum.approved += amount;
      else if (status === 'rejected' || status === 'declined') sum.rejected += amount;
      else if (status === 'hold' || status === 'on hold' || status === 'pending hold') sum.hold += amount;
      sum.all += amount;
      return sum;
    }, {approved:0, rejected:0, hold:0, all:0, count:lines.length});
  }
  function styles() {
    if (document.getElementById(PANEL_ID + '-styles')) return;
    const style = document.createElement('style');
    style.id = PANEL_ID + '-styles';
    style.textContent = `
      #${PANEL_ID}{display:grid;grid-template-columns:minmax(0,1.5fr) repeat(3,minmax(0,1fr));gap:8px;margin:10px 0 12px;padding:12px;border:1px solid #dce5df;border-radius:12px;background:linear-gradient(135deg,#f7fbf8,#fff);box-sizing:border-box;min-width:0}
      #${PANEL_ID} .molms-ab-total{min-width:0;padding:4px 8px;border-left:1px solid #e1e8e3}
      #${PANEL_ID} .molms-ab-total:first-child{border-left:0;padding-left:2px}
      #${PANEL_ID} .molms-ab-label{font-size:10px;line-height:1.4;letter-spacing:.035em;font-weight:800;color:#5c6b64;overflow-wrap:anywhere}
      #${PANEL_ID} .molms-ab-value{font-size:clamp(13px,1.35vw,19px);line-height:1.35;font-weight:900;color:#183b2b;overflow-wrap:anywhere;margin-top:4px}
      #${PANEL_ID} .molms-ab-note{font-size:10px;line-height:1.4;color:#64736b;margin-top:4px}
      #${PANEL_ID} [data-kind="rejected"] .molms-ab-value{color:#a52b25}
      #${PANEL_ID} [data-kind="hold"] .molms-ab-value{color:#95620b}
      @media(max-width:620px){#${PANEL_ID}{grid-template-columns:repeat(2,minmax(0,1fr))}#${PANEL_ID} .molms-ab-total:nth-child(odd){border-left:0}#${PANEL_ID} .molms-ab-total:first-child{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }
  function detailRoot(actions) {
    return actions.closest('[role="dialog"]') || actions.closest('.modal') ||
      actions.closest('[class*="dialog"]') || actions.parentElement && actions.parentElement.parentElement || actions.parentElement;
  }
  function updateLegacyHeadline(root, t) {
    if (!root || !t.count || Math.abs(t.all - t.approved) < 0.005) return;
    const variants = new Set([
      money(t.all),
      Number(t.all).toLocaleString('en-TZ', {maximumFractionDigits:2, minimumFractionDigits:0}),
      Number(t.all).toLocaleString('en-US', {maximumFractionDigits:2, minimumFractionDigits:0})
    ]);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    const candidates = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.id === PANEL_ID || node.closest('#' + PANEL_ID) || node.closest('table,tbody,thead,tr,td,th,button,script,style,select,option')) continue;
      if (node.children.length > 0) continue;
      const text = String(node.textContent || '').trim();
      if (variants.has(text)) candidates.push(node);
    }
    candidates.forEach(el => {
      el.textContent = money(t.approved);
      el.title = 'Approved line items only. Rejected and on-hold items are excluded.';
      el.setAttribute('data-approved-total-replacement', 'true');
    });
  }
  function render() {
    const actions = document.getElementById('bdPanelActions');
    const docId = activeId();
    const lines = getLines();
    if (!actions || !docId || !lines.length) return;
    const t = totals();
    styles();
    let card = document.getElementById(PANEL_ID);
    if (!card) {
      card = document.createElement('section');
      card.id = PANEL_ID;
      card.setAttribute('aria-label', 'Approved amount for this budget document');
      actions.insertAdjacentElement('beforebegin', card);
    }
    card.dataset.budgetId = String(docId);
    card.innerHTML = [
      {kind:'approved', label:'APPROVED BUDGET TOTAL', value:t.approved, note:t.count + ' line item(s) · approved only'},
      {kind:'rejected', label:'REJECTED', value:t.rejected, note:'Excluded from approved total'},
      {kind:'hold', label:'ON HOLD', value:t.hold, note:'Excluded from approved total'},
      {kind:'all', label:'ALL ITEMS', value:t.all, note:'Reference total · not approval amount'}
    ].map(item => '<div class="molms-ab-total" data-kind="' + item.kind + '"><div class="molms-ab-label">' + item.label + '</div><div class="molms-ab-value">' + money(item.value) + '</div><div class="molms-ab-note">' + item.note + '</div></div>').join('');
    updateLegacyHeadline(detailRoot(actions), t);
  }
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; render(); }, 120);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {childList:true, subtree:true});
  window.addEventListener('focus', schedule);
  window.MOLMSApprovedBudgetAmountV1 = {refresh:render};
})();