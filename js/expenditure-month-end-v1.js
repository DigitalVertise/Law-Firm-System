/* MOLMS Expenditure Month-End Workflow V1
 * Monthly register submission, hard entry lock, partner review and auditable return.
 */
(function () {
  'use strict';
  if (window.__molmsExpenseMonthEndV1) return;
  window.__molmsExpenseMonthEndV1 = true;

  const PANEL_ID = 'molms-expense-month-end-v1';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const money = v => 'TZS ' + n(v).toLocaleString('en-TZ', {maximumFractionDigits:2});
  const dateLabel = v => v ? new Date(v).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const client = () => (typeof sb !== 'undefined' && sb) || window.sb || window.supabaseClient || null;
  let busy = false, initializing = false, registers = [], entries = [], currentUser = null, currentRole = '', selectedId = '', confirmAction = '';

  function style() {
    if (document.getElementById(PANEL_ID + '-style')) return;
    const s = document.createElement('style'); s.id = PANEL_ID + '-style';
    s.textContent = `
      #${PANEL_ID}{margin:14px 0 18px;border:1px solid var(--border,#e2ddd5);border-radius:12px;background:#fff;color:var(--navy,#0f2440);padding:16px;box-shadow:0 2px 8px rgba(15,36,64,.05);font:inherit}
      #${PANEL_ID} *{box-sizing:border-box}
      #${PANEL_ID} .em-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
      #${PANEL_ID} .em-title{font-weight:900;font-size:15px;margin:0}
      #${PANEL_ID} .em-sub{font-size:11px;color:var(--muted,#65738a);margin-top:4px;line-height:1.5}
      #${PANEL_ID} .em-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
      #${PANEL_ID} .em-field{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700}
      #${PANEL_ID} input,#${PANEL_ID} select,#${PANEL_ID} textarea{font:inherit;font-weight:400;border:1px solid var(--border,#d8dce2);border-radius:7px;padding:9px 10px;background:#fff;color:inherit;width:100%;min-width:0}
      #${PANEL_ID} textarea{min-height:66px;resize:vertical}
      #${PANEL_ID} .em-wide{grid-column:1/-1}
      #${PANEL_ID} .em-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
      #${PANEL_ID} .em-stat{border:1px solid var(--border,#e2ddd5);border-radius:8px;padding:10px;min-width:0}
      #${PANEL_ID} .em-stat small{display:block;color:var(--muted,#65738a);font-size:10px}
      #${PANEL_ID} .em-stat b{display:block;margin-top:4px;font-size:14px;overflow-wrap:anywhere}
      #${PANEL_ID} .em-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}
      #${PANEL_ID} button{font:inherit;cursor:pointer;border-radius:7px;padding:9px 12px;border:1px solid var(--border,#d8dce2);background:#fff;color:inherit;font-size:11px;font-weight:800}
      #${PANEL_ID} button.em-primary{background:#17365d;color:#fff;border-color:#17365d}
      #${PANEL_ID} button.em-approve{background:#e8f5ec;color:#176b38;border-color:#b8dfc5}
      #${PANEL_ID} button.em-return{background:#fff4e5;color:#8a4b08;border-color:#f2d1a3}
      #${PANEL_ID} button:disabled{opacity:.55;cursor:not-allowed}
      #${PANEL_ID} .em-status{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;background:#eef2f7;color:#34445a;font-size:10px;font-weight:900;text-transform:uppercase}
      #${PANEL_ID} .em-status[data-status="submitted"]{background:#fff2cc;color:#7a5200}
      #${PANEL_ID} .em-status[data-status="approved"]{background:#e7f6ec;color:#176b38}
      #${PANEL_ID} .em-status[data-status="returned"]{background:#fff0e8;color:#9b3d16}
      #${PANEL_ID} .em-note{padding:10px;border-radius:8px;background:#f7f8fa;font-size:11px;line-height:1.5;margin-top:10px}
      #${PANEL_ID} .em-confirm{border:1px solid #e2c98f;background:#fff9e9;border-radius:8px;padding:12px;margin-top:12px}
      #${PANEL_ID} .em-error{color:#b42318;font-size:11px;margin-top:8px;white-space:pre-wrap}
      #${PANEL_ID} .em-ok{color:#176b38;font-size:11px;margin-top:8px}
      #${PANEL_ID} .em-history{border-top:1px solid var(--border,#e2ddd5);margin-top:12px;padding-top:10px;font-size:10px;color:var(--muted,#65738a);line-height:1.6}
      @media(max-width:600px){#${PANEL_ID}{padding:12px}#${PANEL_ID} .em-grid{grid-template-columns:1fr}#${PANEL_ID} .em-wide{grid-column:auto}#${PANEL_ID} .em-stats{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function visible(el){return !!(el && el.getClientRects && el.getClientRects().length && getComputedStyle(el).visibility!=='hidden');}
  function findAnchor(){
    const page = document.querySelector('#page-budget:not([hidden]),#page-expenditure:not([hidden]),#page-expenses:not([hidden]),[data-page="budget"],[data-page="expenditure"],[data-page="expenses"]');
    const candidates = [...document.querySelectorAll('h1,h2,h3,h4')].filter(visible);
    const heading = candidates.find(h => /expenditure register|monthly expenditure|office expenditure|expenditures|expenses/i.test(h.textContent||''));
    if (heading) return {anchor:heading.parentElement || heading, page:heading.closest('main,section,[id^="page-"],[data-page]') || page || heading.parentElement};
    if (page && visible(page) && /expenditure|expense/i.test(page.innerText||'')) return {anchor:page.firstElementChild||page,page};
    return null;
  }

  async function userContext(db){
    try{
      const auth = await db.auth.getUser();
      currentUser = auth && auth.data && auth.data.user || null;
      if(!currentUser) return;
      const rr = await db.from('roles').select('role').eq('user_id',currentUser.id).eq('active',true).limit(1);
      currentRole = rr.data && rr.data[0] && rr.data[0].role || '';
    }catch(e){ console.warn('[MOLMS month-end] user context unavailable',e); }
  }

  async function loadRegisters(db){
    let res = await db.from('expense_registers').select('id,status,opening_balance,closing_balance,budget_document_id,om_remarks,om_achievements,om_challenges,om_major_expenses,om_recommendations,submitted_at,submitted_by,reviewed_at,reviewed_by,review_comments,closed_at,created_at,created_by').order('created_at',{ascending:false});
    if(res.error) throw res.error;
    registers = res.data || [];
    const ids = [...new Set(registers.map(r=>r.budget_document_id).filter(Boolean))];
    if(ids.length){
      const bd = await db.from('budget_documents').select('id,title,budget_month,reference_number').in('id',ids);
      if(!bd.error){
        const byId = Object.fromEntries((bd.data||[]).map(b=>[b.id,b]));
        registers = registers.map(r=>({...r,budget:byId[r.budget_document_id]||null}));
      }
    }
    if(!selectedId || !registers.some(r=>r.id===selectedId)) selectedId = (registers.find(r=>['open','returned','submitted'].includes(r.status))||registers[0]||{}).id || '';
    await loadEntries(db);
  }

  async function loadEntries(db){
    const r = registers.find(x=>x.id===selectedId);
    if(!r){entries=[];return}
    const res = await db.from('expense_entries').select('id,date,category,description,amount,status,paid_to,receipt_number').eq('expense_register_id',r.id).order('date',{ascending:true});
    if(res.error) throw res.error;
    entries = res.data || [];
  }

  function registerLabel(r){
    const month = r.budget && r.budget.budget_month || '';
    const title = r.budget && r.budget.title || 'Monthly expenditure register';
    return (month ? month + ' · ' : '') + title + ' · ' + String(r.status||'open').toUpperCase();
  }
  function canManage(r){return !!r && ['office_manager','office_admin','partner','admin'].includes(currentRole) && ['open','returned'].includes(r.status);}
  function canSubmit(r){return canManage(r);}
  function canReview(r){return !!r && ['partner','admin'].includes(currentRole) && r.status==='submitted';}
  function statusBadge(s){return '<span class="em-status" data-status="'+esc(s)+'">'+esc(s||'open')+'</span>';}
  function statusName(s){return ({open:'Draft / Open',returned:'Returned for correction',submitted:'Submitted — locked',approved:'Approved — locked',closed:'Closed — locked'})[s]||s;}

  function render(){
    const db=client(); if(!db)return;
    const found=findAnchor(); if(!found)return;
    style();
    let panel=document.getElementById(PANEL_ID);
    if(!panel){panel=document.createElement('section');panel.id=PANEL_ID;} if(panel.parentElement !== found.anchor.parentElement || panel.previousElementSibling !== found.anchor) found.anchor.insertAdjacentElement('afterend',panel);
    const r=registers.find(x=>x.id===selectedId);
    if(!r){
      panel.innerHTML='<div class="em-head"><div><h3 class="em-title">Monthly Expenditure Close & Review</h3><div class="em-sub">Submit the completed monthly register to a partner, lock entries, and retain a review history.</div></div></div><div class="em-note">No expenditure registers are visible to your account. Create or open a monthly register first.</div>';
      return;
    }
    const total=entries.reduce((s,e)=>s+n(e.amount),0);
    const editable=canManage(r),reviewable=canReview(r);
    const hist = r.submitted_at ? 'Submitted '+dateLabel(r.submitted_at)+(r.reviewed_at?' · Reviewed '+dateLabel(r.reviewed_at):'') : (r.closed_at?'Closed '+dateLabel(r.closed_at):'Not yet submitted');
    panel.innerHTML = `
      <div class="em-head"><div><h3 class="em-title">Monthly Expenditure Close & Review</h3><div class="em-sub">Prepare the monthly report, submit it to a partner, and lock the register until it is approved or returned.</div></div><div>${statusBadge(r.status)}</div></div>
      <div class="em-grid">
        <label class="em-field em-wide">Monthly register<select id="em-register">${registers.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===selectedId?'selected':'')+'>'+esc(registerLabel(x))+'</option>').join('')}</select></label>
      </div>
      <div class="em-stats">
        <div class="em-stat"><small>Period</small><b>${esc(r.budget&&r.budget.budget_month||'Month not set')}</b></div>
        <div class="em-stat"><small>Recorded entries</small><b>${entries.length}</b></div>
        <div class="em-stat"><small>Total recorded expenditure</small><b>${money(total)}</b></div>
      </div>
      <div class="em-grid">
        <label class="em-field">Opening balance (TZS)<input id="em-opening" type="number" min="0" step="0.01" value="${esc(r.opening_balance||0)}" ${editable?'':'disabled'}></label>
        <label class="em-field">Closing balance (TZS)<input id="em-closing" type="number" min="0" step="0.01" value="${esc(r.closing_balance==null?'':r.closing_balance)}" ${editable?'':'disabled'}></label>
        <label class="em-field em-wide">Month-end remarks<textarea id="em-remarks" ${editable?'':'disabled'}>${esc(r.om_remarks||'')}</textarea></label>
        <label class="em-field">Achievements<textarea id="em-achievements" ${editable?'':'disabled'}>${esc(r.om_achievements||'')}</textarea></label>
        <label class="em-field">Challenges<textarea id="em-challenges" ${editable?'':'disabled'}>${esc(r.om_challenges||'')}</textarea></label>
        <label class="em-field">Major expenses<textarea id="em-major" ${editable?'':'disabled'}>${esc(r.om_major_expenses||'')}</textarea></label>
        <label class="em-field">Recommendations<textarea id="em-recommendations" ${editable?'':'disabled'}>${esc(r.om_recommendations||'')}</textarea></label>
      </div>
      ${r.review_comments?'<div class="em-note"><b>Latest partner comment</b><br>'+esc(r.review_comments)+'</div>':''}
      <div class="em-note"><b>Current stage:</b> ${esc(statusName(r.status))}. ${r.status==='submitted'?'Entries are locked pending partner review.':r.status==='approved'||r.status==='closed'?'The month is locked; only a partner or administrator can reopen it for correction.':r.status==='returned'?'The partner returned this report. Correct the details and resubmit.':'Complete all fields and save before submission.'}</div>
      ${reviewable?'<label class="em-field" style="margin-top:12px">Partner review comment<textarea id="em-review-comment" placeholder="Required when returning for correction; optional for approval."></textarea></label>':''}
      <div class="em-actions">
        ${editable?'<button data-em-action="save">Save month-end details</button><button class="em-primary" data-em-action="confirm-submit">Submit to Partner & Lock</button>':''}
        ${reviewable?'<button class="em-approve" data-em-action="confirm-approve">Approve & Close Month</button><button class="em-return" data-em-action="confirm-return">Return for Correction</button>':''}
        ${['approved','closed'].includes(r.status)&&['partner','admin'].includes(currentRole)?'<button class="em-return" data-em-action="confirm-reopen">Reopen for Correction</button>':''}
        <button data-em-action="refresh">Refresh</button>
      </div>
      <div id="em-confirm"></div><div id="em-feedback" aria-live="polite"></div>
      <div class="em-history">Record: ${esc((r.budget&&r.budget.reference_number)||r.id)} · ${esc(hist)} · ${entries.filter(e=>e.status==='verified').length} verified entries</div>
    `;
    panel.querySelector('#em-register').addEventListener('change',async e=>{selectedId=e.target.value;await reloadAndRender();});
    panel.querySelectorAll('[data-em-action]').forEach(b=>b.addEventListener('click',()=>handleAction(b.dataset.emAction)));
  }

  function feedback(message,ok){
    const el=document.querySelector('#'+PANEL_ID+' #em-feedback');
    if(el)el.className=ok?'em-ok':'em-error';
    if(el)el.textContent=message;
  }
  function confirmBox(action,title,body,buttonLabel){
    confirmAction=action;
    const el=document.querySelector('#'+PANEL_ID+' #em-confirm');if(!el)return;
    el.innerHTML='<div class="em-confirm"><b>'+esc(title)+'</b><div style="font-size:11px;line-height:1.5;margin:6px 0 10px">'+esc(body)+'</div><div class="em-actions" style="margin-top:0"><button class="em-primary" data-em-confirm="yes">'+esc(buttonLabel)+'</button><button data-em-confirm="no">Cancel</button></div></div>';
    el.querySelector('[data-em-confirm="yes"]').addEventListener('click',()=>performConfirmedAction());
    el.querySelector('[data-em-confirm="no"]').addEventListener('click',()=>{confirmAction='';el.innerHTML='';});
  }

  async function saveDetails(db,r){
    const opening = document.querySelector('#em-opening'), closing = document.querySelector('#em-closing');
    if(!opening || !closing) throw new Error('Month-end balance fields are missing. Refresh the module and try again.');
    if(opening.value==='' || closing.value==='') throw new Error('Enter both the opening and closing balances before saving or submitting.');
    if(n(opening.value)<0 || n(closing.value)<0) throw new Error('Balances cannot be negative.');
    const payload={
      opening_balance:n(opening.value),closing_balance:n(closing.value),
      om_remarks:document.querySelector('#em-remarks').value.trim(),
      om_achievements:document.querySelector('#em-achievements').value.trim(),
      om_challenges:document.querySelector('#em-challenges').value.trim(),
      om_major_expenses:document.querySelector('#em-major').value.trim(),
      om_recommendations:document.querySelector('#em-recommendations').value.trim()
    };
    const res=await db.from('expense_registers').update(payload).eq('id',r.id).select('id').maybeSingle();
    if(res.error)throw res.error;
    if(!res.data)throw new Error('No register was updated. Check your access or refresh the register.');
  }

  async function notifyPartners(db,r,action,comment){
    try{
      const targetRole = action==='submitted' ? 'partner' : 'office_manager';
      const users=await db.from('roles').select('user_id,full_name').eq('role',targetRole).eq('active',true);
      if(users.error)throw users.error;
      const recipients=(users.data||[]).filter(x=>x.user_id && x.user_id!==currentUser.id);
      if(!recipients.length)return;
      const title=action==='submitted'?'Monthly expenditure submitted for review':action==='approved'?'Monthly expenditure approved':'Monthly expenditure returned for correction';
      const message=(r.budget&&r.budget.budget_month?r.budget.budget_month+' · ':'')+(r.budget&&r.budget.title||'Monthly expenditure register')+(comment?' — '+comment:'');
      const payload=recipients.map(x=>({recipient_user_id:x.user_id,type:'expenditure_month_end',title,message,source_module:'expenditures',source_record_id:r.id,source_reference:r.budget&&r.budget.reference_number||r.id,action_target:'expenditures',priority:'normal',created_by:currentUser.id}));
      const ins=await db.from('notifications').insert(payload);
      if(ins.error)console.warn('[MOLMS month-end] notification insert failed',ins.error);
    }catch(e){console.warn('[MOLMS month-end] partner notification could not be created',e);}
  }

  async function perform(action){
    const db=client(),r=registers.find(x=>x.id===selectedId);
    if(!db||!r)throw new Error('The expenditure register is unavailable. Refresh and try again.');
    if(action==='save'){
      if(!canManage(r))throw new Error('This register is locked or your role cannot edit it.');
      await saveDetails(db,r);
      await reloadAndRender();
      feedback('Month-end details saved.',true);
      return;
    }
    if(action==='submitted'){
      if(!canSubmit(r))throw new Error('Only the Office Manager or an authorised partner can submit an open or returned register.');
      await saveDetails(db,r);
      const upd=await db.from('expense_registers').update({status:'submitted',review_comments:null}).eq('id',r.id).in('status',['open','returned']).select('id').maybeSingle();
      if(upd.error)throw upd.error;
      if(!upd.data)throw new Error('Submission was not recorded. The register may have changed; refresh and review its current status.');
      await notifyPartners(db,r,'submitted','Ready for partner review');
      await reloadAndRender();
      feedback('Submitted successfully. The monthly register and its entries are now locked pending partner review.',true);
      return;
    }
    if(action==='approved'||action==='returned'||action==='reopened'){
      if(action==='approved'&&!canReview(r))throw new Error('Only a partner or administrator can approve a submitted register.');
      if(action==='returned'&&!canReview(r))throw new Error('Only a partner or administrator can return a submitted register.');
      if(action==='reopened'&&(!['partner','admin'].includes(currentRole)||!['approved','closed'].includes(r.status)))throw new Error('Only a partner or administrator can reopen an approved or closed register.');
      const commentEl=document.querySelector('#em-review-comment');
      const comment=(commentEl?commentEl.value:'').trim();
      if(action==='returned'&&!comment)throw new Error('Please explain what needs correction before returning this report.');
      const newStatus=action==='reopened'?'returned':action;
      const upd=await db.from('expense_registers').update({status:newStatus,review_comments:comment||null}).eq('id',r.id).eq('status',r.status).select('id').maybeSingle();
      if(upd.error)throw upd.error;
      if(!upd.data)throw new Error('The status was not changed. Refresh the register; it may have been reviewed by someone else.');
      await notifyPartners(db,r,action,comment);
      await reloadAndRender();
      feedback(action==='approved'?'Approved. The monthly register is locked and the review is recorded.':action==='returned'?'Returned for correction. The Office Manager can now edit and resubmit it.':'Reopened for correction. The register is unlocked with its review history retained.',true);
    }
  }

  async function handleAction(action){
    if(busy)return;
    if(action==='refresh'){await reloadAndRender();return}
    if(action==='save'||action==='confirm-submit'&&false){busy=true;try{await perform(action)}catch(e){feedback(e.message||String(e),false)}finally{busy=false}return}
    if(action==='confirm-submit'){confirmBox('submitted','Submit and lock this monthly register?','The system will save the month-end details, lock the register and its entries, and notify partners for review. A partner must return it before corrections can be made.','Submit & Lock');return}
    if(action==='confirm-approve'){confirmBox('approved','Approve and close this month?','The register will be marked approved and remain locked. Any later correction requires a partner or administrator to reopen it.','Approve & Close');return}
    if(action==='confirm-return'){confirmBox('returned','Return this report for correction?','Enter a clear review comment. The register will be unlocked for the Office Manager to correct and resubmit.','Return Report');return}
    if(action==='confirm-reopen'){confirmBox('reopened','Reopen this finalised register?','The register will be returned to the Office Manager for correction. The earlier approval remains in the audit history.','Reopen for Correction');return}
  }

  async function performConfirmedAction(){
    const action=confirmAction;confirmAction='';
    const el=document.querySelector('#'+PANEL_ID+' #em-confirm');if(el)el.innerHTML='';
    if(!action)return;
    busy=true;
    try{await perform(action)}catch(e){feedback(e.message||String(e),false)}finally{busy=false}
  }

  async function reloadAndRender(){
    const db=client();if(!db)return;
    try{await loadRegisters(db);render()}catch(e){console.error('[MOLMS month-end workflow]',e);const p=document.getElementById(PANEL_ID);if(p)p.innerHTML='<h3 class="em-title">Monthly Expenditure Close & Review</h3><div class="em-error">Could not load expenditure registers: '+esc(e.message||e)+'</div>';}
  }
  async function init(){
    if(initializing)return; initializing=true;
    try { const db=client();if(!db)return; await userContext(db); await reloadAndRender(); }
    finally { initializing=false; }
  }
  let queued=false;
  function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;const panel=document.getElementById(PANEL_ID);if(!panel){init();return}const found=findAnchor();if(found&&(panel.parentElement!==found.anchor.parentElement||panel.previousElementSibling!==found.anchor))render()},220);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
  const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('focus',schedule);
  window.MOLMSExpenseMonthEndV1={refresh:reloadAndRender};
})();