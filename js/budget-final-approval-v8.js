(function(){
'use strict';
if(window.__budgetFinalApprovalV8)return;
window.__budgetFinalApprovalV8=true;
const db=()=> (typeof sb!=='undefined'&&sb)||window.sb||window.supabaseClient;
const id=()=>{const p=document.getElementById('bdPanelActions');return p&&p.dataset.bdBudgetId||window._bdActiveId||(typeof _bdActiveId!=='undefined'?_bdActiveId:null)};
const alertUser=m=>window.alert(String(m));
async function run(docId){
 if(window.__budgetApprovalBusyV8)return;
 window.__budgetApprovalBusyV8=true;
 const b=document.querySelector('#bdPanelActions [data-bd-finalize]');
 if(b){b.disabled=true;b.textContent='Verifying…'}
 try{
  const s=db();if(!s||!s.from)throw Error('Budget database is unavailable.');
  const uid=window.authUser&&window.authUser.id||(typeof authUser!=='undefined'&&authUser&&authUser.id);
  if(!uid)throw Error('Cannot identify signed-in user. Sign out and sign in again.');
  const rs=await s.from('roles').select('role,active').eq('user_id',uid);
  if(rs.error)throw Error('Role check failed: '+rs.error.message);
  if(!(rs.data||[]).some(x=>String(x.role).toLowerCase()==='partner'&&x.active!==false))throw Error('Only a Partner can give final budget approval.');
  const key=docId||id();if(!key)throw Error('No selected budget ID. Close and reopen the budget.');
  const d=await s.from('budget_documents').select('id,status').eq('id',key).maybeSingle();
  if(d.error)throw Error('Could not read budget: '+d.error.message);
  if(!d.data)throw Error('Budget not found or not accessible.');
  if(String(d.data.status||'').trim().toLowerCase()==='approved'){if(b){b.disabled=true;b.textContent='✓ Budget Approved'}alertUser('This budget is already approved.');return}
  const lr=await s.from('budget_lines').select('id,status').eq('budget_document_id',key);
  if(lr.error)throw Error('Could not read line decisions: '+lr.error.message);
  if(!(lr.data||[]).some(x=>String(x.status||'').trim().toLowerCase()==='approved'))throw Error('Approve at least one budget line before final approval.');
  if(!window.confirm('Approve this budget document? Line decisions will remain unchanged.'))return;
  const wr=await s.from('budget_documents').update({status:'approved',updated_at:new Date().toISOString(),updated_by:uid}).eq('id',key).select('id,status').maybeSingle();
  if(wr.error)throw Error('Database rejected approval: '+wr.error.message);
  const vr=await s.from('budget_documents').select('id,status').eq('id',key).maybeSingle();
  if(vr.error)throw Error('Could not verify saved status: '+vr.error.message);
  if(!vr.data||String(vr.data.status||'').trim().toLowerCase()!=='approved')throw Error('No status change was saved. Check database permissions/RLS. Current status: '+(vr.data?vr.data.status:'not accessible'));
  if(b){b.disabled=true;b.textContent='✓ Budget Approved';b.dataset.bdStatusState='approved'}
  if(typeof bdLoadDocs==='function')await bdLoadDocs();
  if(typeof bdRenderKpiCards==='function')bdRenderKpiCards();
  if(typeof bdRenderList==='function')bdRenderList();
  if(typeof bdOpenDocument==='function')await bdOpenDocument(key);
  alertUser('Final approval saved and verified in the database.');
 }catch(e){console.error('[Budget approval V8]',e);if(b){b.disabled=false;b.textContent='✓ Approve Reviewed Budget'}alertUser('Budget approval failed: '+(e&&e.message||e))}
 finally{window.__budgetApprovalBusyV8=false}
}
document.addEventListener('click',function(e){const b=e.target&&e.target.closest&&e.target.closest('#bdPanelActions [data-bd-finalize]');if(!b)return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();run(id())},true);
window.bdFinalizeBudgetV8=run;
})();