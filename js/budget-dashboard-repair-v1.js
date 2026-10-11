/* MOLMS Budget Dashboard Repair V1
 * Adds live cross-document budget totals and prevents summary text collisions.
 */
(function () {
  'use strict';
  if (window.__molmsBudgetDashboardRepairV1) return;
  window.__molmsBudgetDashboardRepairV1 = true;

  const STYLE_ID = 'molms-budget-dashboard-repair-v1-styles';
  const PANEL_ID = 'molms-budget-dashboard-totals-v1';
  const money = value => 'TZS ' + (Number(value || 0)).toLocaleString('en-TZ', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  function styles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0 16px;width:100%;box-sizing:border-box}
      #${PANEL_ID} .molms-budget-total-card{min-width:0;box-sizing:border-box;background:#fff;border:1px solid var(--border,#e2ddd5);border-radius:10px;padding:12px 13px;box-shadow:0 1px 2px rgba(15,36,64,.04)}
      #${PANEL_ID} .molms-budget-total-label{font-size:10px;line-height:1.4;font-weight:800;letter-spacing:.035em;color:var(--muted,#65738a);white-space:normal;overflow-wrap:anywhere;margin:0 0 7px}
      #${PANEL_ID} .molms-budget-total-value{font-size:clamp(14px,1.5vw,20px);line-height:1.35;font-weight:900;color:var(--navy,#0f2440);white-space:normal;overflow-wrap:anywhere;word-break:normal;margin:0}
      #${PANEL_ID} .molms-budget-total-note{font-size:10px;line-height:1.45;color:var(--muted,#65738a);margin-top:5px;overflow-wrap:anywhere}
      #${PANEL_ID} [data-total="approved"] .molms-budget-total-value{color:#167443}
      #${PANEL_ID} [data-total="rejected"] .molms-budget-total-value{color:#b42318}
      #${PANEL_ID} [data-total="hold"] .molms-budget-total-value{color:#a16207}
      #page-budget{min-width:0}
      #page-budget *{min-width:0}
      #page-budget h1,#page-budget h2,#page-budget h3,#page-budget h4,
      #page-budget p,#page-budget label,#page-budget th,#page-budget td,
      #page-budget small,#page-budget .muted,#page-budget [class*="summary"],
      #page-budget [class*="Summary"],#page-budget [class*="detail"],
      #page-budget [class*="Detail"]{line-height:1.45;overflow-wrap:anywhere;word-break:normal}
      #page-budget table{width:100%;border-collapse:collapse;table-layout:auto}
      #page-budget th,#page-budget td{vertical-align:top;white-space:normal}
      #page-budget .card,#page-budget [class*="card"],#page-budget [class*="panel"]{box-sizing:border-box;max-width:100%}
      @media(max-width:900px){#${PANEL_ID}{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:520px){#${PANEL_ID}{grid-template-columns:minmax(0,1fr)}#${PANEL_ID} .molms-budget-total-value{font-size:18px}}
    `;
    document.head.appendChild(style);
  }

  function budgetRoot() {
    return document.getElementById('page-budget') ||
      document.querySelector('[data-page="budget"]') ||
      document.querySelector('#budgetPage');
  }

  function renderPanel(root, totals, count) {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.setAttribute('aria-label', 'Budget totals across all budget documents');
      const heading = [...root.querySelectorAll('h1,h2,h3')].find(el => /budget/i.test(el.textContent || ''));
      if (heading && heading.parentElement) heading.parentElement.insertAdjacentElement('afterend', panel);
      else root.insertBefore(panel, root.firstChild);
    }
    const cards = [
      {key:'requested',label:'TOTAL REQUESTED',value:totals.requested,note:'Requested total across budget documents'},
      {key:'approved',label:'TOTAL APPROVED',value:totals.approved,note:'Budget lines approved by review'},
      {key:'rejected',label:'TOTAL REJECTED',value:totals.rejected,note:'Budget lines rejected by review'},
      {key:'hold',label:'ON HOLD',value:totals.hold,note:'Budget lines awaiting a decision'}
    ];
    panel.innerHTML = cards.map(card => `
      <article class="molms-budget-total-card" data-total="${card.key}">
        <div class="molms-budget-total-label">${esc(card.label)}</div>
        <div class="molms-budget-total-value">${esc(money(card.value))}</div>
        <div class="molms-budget-total-note">${esc(card.note)}</div>
      </article>`).join('');
    panel.setAttribute('data-budget-count', String(count));
    panel.setAttribute('data-source', 'budget_documents_summary');
  }

  async function refresh() {
    const root = budgetRoot();
    if (!root) return;
    styles();
    const client = (typeof sb !== 'undefined' && sb) || window.sb || window.supabaseClient;
    if (!client || typeof client.from !== 'function') return;
    const panel = document.getElementById(PANEL_ID);
    if (panel && panel.dataset.loading === '1') return;
    if (panel) panel.dataset.loading = '1';
    try {
      const result = await client.from('budget_documents_summary')
        .select('id,total_requested,total_approved,total_rejected,total_held');
      if (result.error) throw result.error;
      const rows = result.data || [];
      const totals = rows.reduce((sum, row) => {
        sum.requested += num(row.total_requested);
        sum.approved += num(row.total_approved);
        sum.rejected += num(row.total_rejected);
        sum.hold += num(row.total_held);
        return sum;
      }, {requested:0, approved:0, rejected:0, hold:0});
      renderPanel(root, totals, rows.length);
    } catch (error) {
      console.error('[MOLMS budget dashboard repair]', error);
      if (!document.getElementById(PANEL_ID)) {
        const panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.innerHTML = '<div class="molms-budget-total-card">Budget totals could not be loaded. Please refresh the module.</div>';
        root.insertBefore(panel, root.firstChild);
      }
    } finally {
      const current = document.getElementById(PANEL_ID);
      if (current) delete current.dataset.loading;
    }
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; refresh(); }, 180);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {childList:true, subtree:true});
  window.addEventListener('focus', schedule);
  window.addEventListener('load', schedule);
  window.MOLMSBudgetDashboardRepairV1 = {refresh};
})();
