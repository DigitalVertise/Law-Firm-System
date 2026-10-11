/* MOLMS Budget Final Approval V6: visible diagnostics for failed approval. */
(function () {
  'use strict';
  if (window.__budgetFinalApprovalV6) return;
  window.__budgetFinalApprovalV6 = true;

  function activeId() {
    var panel = document.getElementById('bdPanelActions');
    return (panel && panel.dataset.bdBudgetId) || window._bdActiveId ||
      (typeof _bdActiveId !== 'undefined' ? _bdActiveId : null);
  }
  function lines() {
    if (Array.isArray(window._bdLines)) return window._bdLines;
    if (typeof _bdLines !== 'undefined' && Array.isArray(_bdLines)) return _bdLines;
    return [];
  }
  function isPartner() {
    return String(window.authRole || (typeof authRole !== 'undefined' ? authRole : '')).toLowerCase() === 'partner';
  }
  function notify(text, type) {
    // Always surface the result: the app's notice/toast can be hidden behind the iframe/modal.
    window.alert(String(text));
  }
  function freezeButton(docId) {
    var panel = document.getElementById('bdPanelActions');
    var button = panel && panel.querySelector('[data-bd-finalize]');
    if (!button) return;
    button.disabled = true;
    button.textContent = '✓ Budget Approved';
    button.title = 'This budget has already received final approval and cannot be approved again.';
    button.setAttribute('aria-disabled', 'true');
    button.dataset.bdStatusDoc = String(docId || activeId() || '');
    button.dataset.bdStatusState = 'approved';
    button.classList.add('bd-finalize-locked');
  }
  async function syncApprovalState() {
    var panel = document.getElementById('bdPanelActions');
    var button = panel && panel.querySelector('[data-bd-finalize]');
    var docId = activeId();
    if (!button || !docId) return;
    if (button.dataset.bdStatusDoc === String(docId) &&
        (button.dataset.bdStatusState === 'approved' || button.dataset.bdStatusState === 'not-approved' || button.dataset.bdStatusState === 'checking')) return;
    button.dataset.bdStatusDoc = String(docId);
    button.dataset.bdStatusState = 'checking';
    button.disabled = true;
    button.textContent = 'Checking budget status…';
    try {
      var client = (typeof sb !== 'undefined' && sb) || window.sb || window.supabaseClient;
      if (!client || !client.from) throw new Error('Budget data service unavailable');
      var result = await client.from('budget_documents').select('id,status').eq('id', docId).maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('Budget not found');
      if (String(result.data.status || '').toLowerCase() === 'approved') {
        freezeButton(docId);
      } else {
        button.disabled = false;
        button.textContent = '✓ Approve Reviewed Budget';
        button.title = 'Approve this reviewed budget document';
        button.removeAttribute('aria-disabled');
        button.classList.remove('bd-finalize-locked');
        button.dataset.bdStatusState = 'not-approved';
      }
    } catch (error) {
      console.warn('[Budget approval] Could not pre-check status; approval handler will verify before writing.', error);
      button.disabled = false;
      button.textContent = '✓ Approve Reviewed Budget';
      button.dataset.bdStatusState = 'unchecked';
    }
  }
  async function approve(id) {
    if (window.__budgetFinalApprovalBusy) return;
    window.__budgetFinalApprovalBusy = true;
    try {
      if (!isPartner()) throw new Error('Only a Partner can approve a budget.');
      var docId = id || activeId();
      if (!docId) throw new Error('No selected budget ID was found. Close and reopen the budget.');
      if (!lines().some(function (line) { return String(line.status || '').toLowerCase() === 'approved'; })) {
        throw new Error('No approved budget lines were found. Review and approve at least one line first.');
      }
      var client = (typeof sb !== 'undefined' && sb) || window.sb || window.supabaseClient;
      if (!client || !client.from) throw new Error('Budget database connection is unavailable.');
      var current = await client.from('budget_documents').select('id,status').eq('id', docId).maybeSingle();
      if (current.error) throw new Error('Could not verify the current budget status: ' + current.error.message);
      if (!current.data) throw new Error('The selected budget document no longer exists.');
      if (String(current.data.status || '').toLowerCase() === 'approved') {
        freezeButton(docId);
        notify('This budget has already been approved. Further approval is disabled.');
        return;
      }
      if (!window.confirm('Approve this budget document? Line decisions will remain unchanged.')) return;
      console.info('[Budget approval V6] Confirmed approval', { docId: docId, role: (window.authRole || (typeof authRole !== 'undefined' ? authRole : '')), approvedLines: lines().filter(function (line) { return String(line.status || '').toLowerCase() === 'approved'; }).length });
      var payload = { status: 'approved', updated_at: new Date().toISOString() };
      var user = window.authUser || (typeof authUser !== 'undefined' ? authUser : null);
      if (user && user.id) payload.updated_by = user.id;

      var write = await client.from('budget_documents').update(payload).eq('id', docId).select('id,status').maybeSingle();
      if (write.error) throw new Error('Database update failed: ' + write.error.message);
      if (!write.data) {
        var current = await client.from('budget_documents').select('id,status').eq('id', docId).maybeSingle();
        if (current.error) throw new Error('Cannot verify budget status: ' + current.error.message);
        throw new Error('Database updated no row. Current status: ' + (current.data ? current.data.status : 'record not found') + '. Check Partner permissions and active project.');
      }
      var check = await client.from('budget_documents').select('id,status').eq('id', docId).maybeSingle();
      if (check.error) throw new Error('Status verification failed: ' + check.error.message);
      if (!check.data || String(check.data.status).toLowerCase() !== 'approved') throw new Error('Status did not persist. Database status: ' + (check.data ? check.data.status : 'record not found'));
      freezeButton(docId);
      try { if (typeof bdRecordAudit === 'function') await bdRecordAudit('approved', 'Budget document approved by Partner.'); } catch (e) { console.error('Budget audit failed', e); }
      if (typeof bdLoadDocs === 'function') await bdLoadDocs();
      if (typeof bdRenderKpiCards === 'function') bdRenderKpiCards();
      if (typeof bdRenderList === 'function') bdRenderList();
      if (typeof bdOpenDocument === 'function') await bdOpenDocument(docId);
      notify('Approved: database status verified.');
    } catch (e) {
      console.error('[Budget approval V6]', e);
      notify('Budget approval failed: ' + (e && e.message ? e.message : String(e)), 'err');
    } finally {
      window.__budgetFinalApprovalBusy = false;
    }
  }
  window.bdFinalizeBudget = approve;
  function install() {
    var panel = document.getElementById('bdPanelActions');
    if (!panel || !isPartner()) return;
    // Idempotent: never remove/recreate the button during observer callbacks.
    if (panel.querySelector('[data-bd-finalize]')) { syncApprovalState(); return; }
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn gold';
    button.setAttribute('data-bd-finalize', '1');
    button.textContent = '✓ Approve Reviewed Budget';
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      approve(activeId());
    });
    panel.appendChild(button);
    var style = document.getElementById('molms-budget-final-approval-lock-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'molms-budget-final-approval-lock-style';
      style.textContent = '[data-bd-finalize].bd-finalize-locked,[data-bd-finalize]:disabled{opacity:.62;cursor:not-allowed;filter:grayscale(.25);pointer-events:none}';
      document.head.appendChild(style);
    }
    syncApprovalState();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  var observer = new MutationObserver(function () { install(); });
  observer.observe(document.body, { childList: true, subtree: true });
})();