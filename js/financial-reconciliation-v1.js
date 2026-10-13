/* MOLMS financial dashboard reconciliation patch.
 * Manual transaction history follows the selected reporting period.
 * Cash uses dated cash receipts (not withholding tax) and recorded outflows.
 * No opening cash balance is invented: totals represent net recorded activity.
 */
(function molmsFinanceReconciliationV1(){
  'use strict';
  const n=v=>Number(v||0), d=v=>String(v||'').slice(0,10);
  const add=(o,c,v)=>{c=c||'TZS';o[c]=(o[c]||0)+n(v)};
  const approved=t=>String(t?.status||(t?.is_approved?'approved':'pending')).toLowerCase()==='approved';
  const allCurrencies=o=>{if(!Object.prototype.hasOwnProperty.call(o,'TZS'))o.TZS=0;return o};
  let paymentLedger=[],paymentLedgerReady=false,paymentLoadPromise=null;
  function period(){try{return fdGetPeriodDates()}catch(_){const x=new Date(),p=v=>String(v).padStart(2,'0');return {start:x.getFullYear()+'-'+p(x.getMonth()+1)+'-01',end:x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate())}}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function status(t){return String(t?.status||(t?.is_approved?'approved':'pending')).toLowerCase()}
  function rowsOf(name,fallback){try{const x=typeof _fdAllManual!=='undefined'&&name==='manual'?_fdAllManual:name==='invoices'&&typeof _fdAllInvoices!=='undefined'?_fdAllInvoices:name==='entries'&&typeof _fdAllEntries!=='undefined'?_fdAllEntries:name==='payroll'&&typeof _fdAllPayroll!=='undefined'?_fdAllPayroll:name==='office'&&typeof _fdAllOfficeExpenses!=='undefined'?_fdAllOfficeExpenses:name==='historical'&&typeof _fdAllHistPayroll!=='undefined'?_fdAllHistPayroll:[];return Array.isArray(x)?x:(fallback||[])}catch(_){return fallback||[]}}
  function renderManual(){
    const tbody=document.getElementById('fdManualBody');if(!tbody)return;
    const {start,end}=period(),all=rowsOf('manual',typeof _fdManualTx!=='undefined'?_fdManualTx:[]);
    const mode=document.getElementById('fdPeriod')?.value||'month';
    const rows=all.filter(t=>mode==='all'||(d(t.date)>=start&&d(t.date)<=end)).slice().sort((a,b)=>d(b.date).localeCompare(d(a.date))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
    if(!rows.length){tbody.innerHTML='<tr><td colspan="10" style="padding:12px;text-align:center;color:var(--muted)">No manual transactions recorded for '+esc(typeof fdPeriodLabel==='function'?fdPeriodLabel():'the selected period')+'. Historical transactions remain saved.</td></tr>';return}
    tbody.innerHTML=rows.map(t=>{
      const s=status(t),col={approved:'#16a34a',rejected:'#dc2626',cancelled:'#64748b',pending:'#d97706'}[s]||'#64748b';
      const actions=s==='pending'
        ? `<button onclick="fdSetManualStatus('${esc(t.id)}','approved')" title="Approve">✓</button><button onclick="fdSetManualStatus('${esc(t.id)}','rejected')" title="Reject">✕</button><button onclick="fdSetManualStatus('${esc(t.id)}','cancelled')" title="Cancel">⊘</button><button onclick="fdEditManual('${esc(t.id)}')" title="Edit">✎</button>`
        :s==='approved'
        ? `<button onclick="fdEditManual('${esc(t.id)}')" title="Edit — reopens for approval">✎</button><button onclick="fdSetManualStatus('${esc(t.id)}','cancelled')" title="Cancel">⊘</button>`
        :s==='cancelled'
        ? `<button onclick="fdEditManual('${esc(t.id)}')" title="Edit & Resubmit">✎</button><button onclick="fdDeleteManual('${esc(t.id)}')" title="Delete">🗑</button>`
        :`<button onclick="fdEditManual('${esc(t.id)}')" title="Edit — reopens for approval">✎</button>`;
      return `<tr><td style="padding:5px;font:10px monospace;color:#1e40af">${esc(t.reference||'—')}</td><td>${esc(d(t.date))}</td><td>${esc(t.tx_type||'—')}</td><td>${esc(t.category||'—')}</td><td>${esc(t.description||'—')}</td><td style="text-align:right;font-weight:700">${esc(t.currency||'TZS')} ${n(t.amount).toLocaleString()}</td><td>${esc(t.counterparty||'—')}</td><td>${esc(t.approved_by||t.approved_by_name||'—')}</td><td><span style="color:${col};font-weight:700">${esc(s)}</span></td><td>${actions}</td></tr>`;
    }).join('');
  }
  async function loadPayments(){
    if(paymentLoadPromise)return paymentLoadPromise;if(typeof sb==='undefined'||!sb)return false;
    paymentLoadPromise=(async()=>{try{const {data,error}=await sb.from('invoice_payments').select('id,invoice_id,payment_date,cash_amount,withholding_tax_amount,created_at');if(error)throw error;paymentLedger=Array.isArray(data)?data:[];paymentLedgerReady=true;return true}catch(e){console.warn('[MOLMS finance reconciliation] invoice payment ledger unavailable; using legacy receipt records',e);return false}finally{paymentLoadPromise=null}})();
    return paymentLoadPromise;
  }
  function invoiceCashRows(inv){
    const stored=Math.max(0,n(inv.amount_paid));if(!stored)return [];
    const ledger=paymentLedger.filter(p=>p.invoice_id===inv.id).map(p=>({date:d(p.payment_date),amount:Math.max(0,n(p.cash_amount)),currency:inv.currency||'TZS'}));
    if(ledger.length&&Math.abs(ledger.reduce((s,r)=>s+r.amount,0)-stored)<0.01)return ledger;
    const notes=[];let m;const re=/\[Payment\s+(\d{4}-\d{2}-\d{2})\]\s+Cash\s+([\d,]+(?:\.\d+)?)/gi;
    while((m=re.exec(String(inv.notes||'')))!==null){const amount=n(m[2].replace(/,/g,''));if(amount>0)notes.push({date:m[1],amount,currency:inv.currency||'TZS'})}
    if(notes.length&&Math.abs(notes.reduce((s,r)=>s+r.amount,0)-stored)<0.01)return notes;
    return [{date:d(inv.updated_at||inv.invoice_date),amount:stored,currency:inv.currency||'TZS'}];
  }
  function cashThrough(end){
    const inflow={},outflow={},invoices=Array.isArray(window._fdAllInvoices)?window._fdAllInvoices:[];
    invoices.flatMap(invoiceCashRows).filter(r=>r.date&&r.date<=end).forEach(r=>add(inflow,r.currency,r.amount));
    rowsOf('manual').filter(t=>approved(t)&&d(t.date)&&d(t.date)<=end).forEach(t=>{if(t.tx_type==='revenue'||t.tx_type==='loan')add(inflow,t.currency,t.amount);if(t.tx_type==='expenditure'||t.tx_type==='drawing')add(outflow,t.currency,t.amount)});
    rowsOf('entries').filter(e=>d(e.date)&&d(e.date)<=end&&status(e)!=='cancelled').forEach(e=>add(outflow,'TZS',e.amount));
    const payroll=rowsOf('payroll'),precedence={locked:3,approved:2,submitted:1,draft:0,rejected:-1},byMonth={};
    payroll.forEach(r=>{const m=r.payroll_month||String(r.created_at||'').slice(0,7);if(!m)return;const old=byMonth[m];if(!old||(precedence[r.status]??-1)>(precedence[old.status]??-1)||((precedence[r.status]??-1)===(precedence[old.status]??-1)&&new Date(r.created_at||0)>new Date(old.created_at||0)))byMonth[m]=r});
    Object.values(byMonth).filter(r=>(r.payroll_month?r.payroll_month+'-01':d(r.created_at))<=end&&String(r.status||'').toLowerCase()!=='cancelled').forEach(r=>add(outflow,'TZS',n(r.net_pay||r.total_net||r.gross_pay||r.amount||r.total_amount)));
    rowsOf('office').filter(e=>d(e.expense_date)&&d(e.expense_date)<=end&&!e.archived_at).forEach(e=>add(outflow,'TZS',e.amount));
    const nativeMonths=new Set(Object.values(byMonth).map(r=>r.payroll_month).filter(Boolean));
    rowsOf('historical').filter(h=>!h.archived_at&&!nativeMonths.has(h.period_month)&&(String(h.period_month||'')+'-01')<=end).forEach(h=>add(outflow,'TZS',h.amount));
    const result={};new Set([...Object.keys(inflow),...Object.keys(outflow),'TZS']).forEach(c=>result[c]=(inflow[c]||0)-(outflow[c]||0));return allCurrencies(result);
  }
  window.fdCashContinuity=function(){
    const {start,end}=period(),mode=document.getElementById('fdPeriod')?.value||'month';
    if(mode==='all')return {openingByCur:{TZS:0},closingByCur:cashThrough(end),start,end};
    const prev=new Date(start+'T00:00:00');prev.setDate(prev.getDate()-1);const prior=prev.getFullYear()+'-'+String(prev.getMonth()+1).padStart(2,'0')+'-'+String(prev.getDate()).padStart(2,'0');
    return {openingByCur:cashThrough(prior),closingByCur:cashThrough(end),start,end};
  };
  function repaint(){renderManual();if(document.getElementById('fdKpiRow')&&typeof window.MOLMSFinanceV16?.render==='function')window.MOLMSFinanceV16.render();else if(typeof window.fdRenderKpi==='function')window.fdRenderKpi()}
  const baseRefresh=window.fdRefresh;
  if(typeof baseRefresh==='function'&&!baseRefresh.__molmsFinanceReconciliationV1){const wrapped=async function(){const result=await baseRefresh.apply(this,arguments);await loadPayments();repaint();return result};wrapped.__molmsFinanceReconciliationV1=true;window.fdRefresh=wrapped}
  window.addEventListener('load',async()=>{await loadPayments();repaint()});
  let lastKey='';setInterval(()=>{if(!document.getElementById('page-findash'))return;const {start,end}=period(),key=[start,end,rowsOf('manual').length,rowsOf('invoices').length,rowsOf('entries').length,paymentLedger.length].join('|');if(key!==lastKey){lastKey=key;repaint()}},1500);
  window.MOLMSFinanceReconciliationV1={refresh:async()=>{await loadPayments();repaint()},audit:()=>({period:period(),paymentLedgerRows:paymentLedger.length,paymentLedgerReady,closingCash:window.fdCashContinuity().closingByCur,manualRowsVisible:document.querySelectorAll('#fdManualBody tr').length,manualLoaded:rowsOf('manual').length,invoicesLoaded:rowsOf('invoices').length})};
})();