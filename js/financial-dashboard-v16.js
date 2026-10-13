/* MOLMS Financial Dashboard V16
 * One financial interpretation for recognised revenue, cash collections and
 * receivables. Proformas remain pipeline. Currencies are never combined.
 */
(function financialDashboardV16(){
  'use strict';

  const q=id=>document.getElementById(id);
  const num=v=>Number(v||0);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const date=v=>String(v||'').slice(0,10);
  const add=(o,c,v)=>{c=c||'TZS';o[c]=(o[c]||0)+num(v);return o;};
  const approved=t=>String(t?.status||(t?.is_approved?'approved':'pending')).toLowerCase()==='approved';
  const money=(c,v)=>`${c||'TZS'} ${num(v).toLocaleString()}`;
  const short=n=>{n=num(n);return Math.abs(n)>=1e9?(n/1e9).toFixed(1).replace('.0','')+'B':Math.abs(n)>=1e6?(n/1e6).toFixed(1).replace('.0','')+'M':Math.abs(n)>=1e3?(n/1e3).toFixed(1).replace('.0','')+'K':n.toLocaleString()};
  const moneyLines=(byCur,compact=true)=>{
    const ordered=['TZS',...Object.keys(byCur||{}).filter(c=>c!=='TZS').sort()];
    return [...new Set(ordered)].filter(c=>c==='TZS'||num(byCur[c])!==0).map(c=>({currency:c,value:num(byCur[c]),text:`${c} ${compact?short(byCur[c]):num(byCur[c]).toLocaleString()}`}));
  };

  let paymentRows=[];
  let rendering=false;

  function data(){
    let invoices=[],manual=[],entries=[],payroll=[],office=[],historical=[];
    try{invoices=typeof _fdAllInvoices!=='undefined'&&Array.isArray(_fdAllInvoices)?_fdAllInvoices:[]}catch(e){}
    try{manual=typeof _fdAllManual!=='undefined'&&Array.isArray(_fdAllManual)?_fdAllManual:[]}catch(e){}
    try{entries=typeof _fdAllEntries!=='undefined'&&Array.isArray(_fdAllEntries)?_fdAllEntries:[]}catch(e){}
    try{payroll=typeof _fdAllPayroll!=='undefined'&&Array.isArray(_fdAllPayroll)?_fdAllPayroll:[]}catch(e){}
    try{office=typeof _fdAllOfficeExpenses!=='undefined'&&Array.isArray(_fdAllOfficeExpenses)?_fdAllOfficeExpenses:[]}catch(e){}
    try{historical=typeof _fdAllHistPayroll!=='undefined'&&Array.isArray(_fdAllHistPayroll)?_fdAllHistPayroll:[]}catch(e){}
    return {invoices,manual,entries,payroll,office,historical};
  }

  function bounds(){
    try{return fdGetPeriodDates()}catch(e){const now=new Date(),p=n=>String(n).padStart(2,'0');return {start:`${now.getFullYear()}-${p(now.getMonth()+1)}-01`,end:`${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}`}}
  }

  function validTax(i){
    const st=String(i.status||'').toLowerCase();
    return String(i.invoice_type||'tax').toLowerCase()==='tax'&&!['draft','void','cancelled','superseded'].includes(st);
  }

  function receipts(i){
    const ledger=paymentRows.filter(p=>p.invoice_id===i.id).map(p=>({date:date(p.payment_date),cash:num(p.cash_amount),wht:num(p.withholding_tax_amount)}));
    const ledgerCash=ledger.reduce((s,r)=>s+r.cash,0),ledgerWht=ledger.reduce((s,r)=>s+r.wht,0);
    const storedCash=Math.max(0,num(i.amount_paid)),storedWht=Math.max(0,num(i.withholding_tax_amount));
    if(ledger.length&&Math.abs(ledgerCash-storedCash)<.01&&Math.abs(ledgerWht-storedWht)<.01)return ledger;
    const parsed=[];let m;
    const re=/\[Payment\s+(\d{4}-\d{2}-\d{2})\]\s+Cash\s+([\d,]+(?:\.\d+)?)(?:\s+\+\s+WHT\s+([\d,]+(?:\.\d+)?))?/gi;
    while((m=re.exec(String(i.notes||'')))!==null)parsed.push({date:m[1],cash:num(m[2].replace(/,/g,'')),wht:num((m[3]||'0').replace(/,/g,''))});
    const parsedCash=parsed.reduce((s,r)=>s+r.cash,0),parsedWht=parsed.reduce((s,r)=>s+r.wht,0);
    if(parsed.length&&Math.abs(parsedCash-storedCash)<.01&&Math.abs(parsedWht-storedWht)<.01)return parsed;
    if(storedCash||storedWht)return [{date:date(i.updated_at||i.invoice_date),cash:storedCash,wht:storedWht,legacy:true}];
    return [];
  }

  function invoicePaidAsOf(i,end){return receipts(i).filter(r=>r.date<=end).reduce((s,r)=>s+r.cash+r.wht,0)}

  function periodClientRows(){
    const {start,end}=bounds(),{invoices,manual}=data(),rows=[];
    invoices.filter(i=>validTax(i)&&date(i.invoice_date)>=start&&date(i.invoice_date)<=end).forEach(i=>{
      const revenue=num(i.total_due),paid=invoicePaidAsOf(i,end),outstanding=Math.max(0,revenue-paid);
      rows.push({kind:'invoice',id:i.id,client:i.client_name||'Unknown client',matter:i.matter_ref||i.matter_title||'General / Unlinked',source:i.invoice_number||'—',currency:i.currency||'TZS',revenue,paid,outstanding,status:outstanding<=.01?'Paid':paid>0?'Part Paid':'Unpaid'});
    });
    manual.filter(t=>approved(t)&&t.tx_type==='revenue'&&date(t.date)>=start&&date(t.date)<=end).forEach(t=>{
      const paid=num(t.amount),revenue=t.client_receivable&&num(t.agreed_amount)>0?num(t.agreed_amount):paid;
      const outstanding=t.client_receivable?Math.max(0,num(t.outstanding_amount)||revenue-paid):0;
      rows.push({kind:'manual',id:t.id,client:t.receivable_client_name||t.counterparty||'Other revenue',matter:t.receivable_matter_ref||t.description||'General / Unlinked',source:t.reference||'Manual revenue',currency:t.currency||'TZS',revenue,paid,outstanding,status:outstanding<=.01?'Paid':paid>0?'Part Paid':'Unpaid'});
    });
    return rows.sort((a,b)=>b.revenue-a.revenue);
  }

  function localToday(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // Receivables are a live balance, not a period-flow metric. Always reconcile
  // against payments recorded through today, even when the dashboard is set to
  // a prior reporting period; otherwise a payment made after that period-end is
  // incorrectly shown as unpaid in the live receivables card.
  function allReceivables(){
    const end=localToday(),{invoices,manual}=data(),rows=[];
    invoices.filter(i=>validTax(i)&&date(i.invoice_date)<=end).forEach(i=>{
      const total=num(i.total_due),paid=invoicePaidAsOf(i,end),outstanding=Math.max(0,total-paid);
      if(outstanding>.01)rows.push({kind:'invoice',id:i.id,client:i.client_name||'Unknown client',matter:i.matter_ref||i.matter_title||'General / Unlinked',source:i.invoice_number||'—',currency:i.currency||'TZS',revenue:total,paid,outstanding,status:paid>0?'Part Paid':'Unpaid'});
    });
    manual.filter(t=>approved(t)&&t.client_receivable&&date(t.date)<=end).forEach(t=>{
      const outstanding=Math.max(0,num(t.outstanding_amount));if(outstanding<=.01)return;
      rows.push({kind:'manual',id:t.id,client:t.receivable_client_name||t.counterparty||'Unknown client',matter:t.receivable_matter_ref||t.description||'General / Unlinked',source:t.reference||'—',currency:t.currency||'TZS',revenue:num(t.agreed_amount||t.amount),paid:num(t.amount),outstanding,status:'Part Paid'});
    });
    return rows.sort((a,b)=>b.outstanding-a.outstanding);
  }

  function totals(rows,key){const out={TZS:0};rows.forEach(r=>add(out,r.currency,r[key]));return out}

  function periodExpenses(){
    const {start,end}=bounds(),{manual}=data(),out={TZS:0};
    manual.filter(t=>approved(t)&&t.tx_type==='expenditure'&&date(t.date)>=start&&date(t.date)<=end)
      .forEach(t=>add(out,t.currency,t.amount));
    return out;
  }

  function cashPosition(){
    const {start,end}=bounds(),{invoices,manual}=data(),movement={TZS:0};
    invoices.filter(validTax).forEach(i=>receipts(i).filter(r=>r.date>=start&&r.date<=end).forEach(r=>add(movement,i.currency,num(r.cash))));
    manual.filter(t=>approved(t)&&date(t.date)>=start&&date(t.date)<=end).forEach(t=>{
      const type=String(t.tx_type||'').toLowerCase();
      if(type==='revenue')add(movement,t.currency,num(t.amount));
      else if(type==='expenditure'||type==='drawing')add(movement,t.currency,-num(t.amount));
    });
    return {openingByCur:{},closingByCur:movement,movementByCur:movement};
  }

  function metrics(){
    const rows=periodClientRows(),revenue=totals(rows,'revenue'),collected=totals(rows,'paid'),newReceivables=totals(rows,'outstanding'),expenses=periodExpenses(),cash=cashPosition();
    return {rows,revenue,collected,newReceivables,expenses,cash,totalReceivables:totals(allReceivables(),'outstanding')};
  }

  function card(title,values,color,note){
    return `<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:9px 10px"><div style="font-size:9px;font-weight:800;color:var(--muted);margin-bottom:3px">${esc(title)}</div>${moneyLines(values).map((l,i)=>`<div style="font-size:${i?'12px':'16px'};font-weight:900;line-height:1.2;color:${color}">${esc(l.text)}</div>`).join('')}<div style="font-size:9px;color:var(--muted);margin-top:3px">${esc(note)}</div></div>`;
  }

  function renderKpis(){
    const host=q('fdKpiRow');if(!host)return;const m=metrics(),label=typeof fdPeriodLabel==='function'?fdPeriodLabel():'Selected period';
    host.style.display='grid';host.style.gridTemplateColumns='repeat(auto-fit,minmax(165px,1fr))';host.style.gap='10px';
    host.innerHTML=[
      card('RECOGNISED REVENUE',m.revenue,'#15803d',`Invoices + approved manual revenue · ${label}`),
      card('PAYMENTS RECEIVED',m.collected,'#1d4ed8',`Invoice integration + manual revenue · ${label}`),
      card('NEW RECEIVABLES',m.newReceivables,'#b45309',`Unpaid fees · ${label}`),
      card('MANUAL EXPENDITURE',m.expenses,'#b91c1c',`Posted manual expenditure only · ${label}`),
      card('NET RECORDED CASH MOVEMENT',m.cash.movementByCur||{},'#1d4ed8',`Receipts less manual payments · ${bounds().start} to ${bounds().end}; not a bank balance`)
    ].join('');
  }

  function renderReceivables(){
    const host=q('fdReceivablesCardV1')||q('fdReceivablesCardV2');if(!host)return;const rows=allReceivables(),tot=totals(rows,'outstanding');
    host.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px"><div><div style="font-size:11px;font-weight:800;color:var(--navy)">CLIENTS WITH OUTSTANDING FEES</div>${moneyLines(tot,false).map((l,i)=>`<div style="font-size:${i?'13px':'21px'};font-weight:900;color:#b45309;margin-top:2px">${esc(l.text)}</div>`).join('')}<div style="font-size:10px;color:var(--muted);margin-top:2px">Live balance as at ${esc(localToday())}</div></div><div style="font-size:9px;color:var(--muted);text-align:right">${rows.length} open</div></div><div>${rows.slice(0,6).map(r=>`<button data-v16-kind="${r.kind}" data-v16-id="${esc(r.id)}" style="width:100%;display:flex;justify-content:space-between;gap:10px;align-items:center;border:0;border-top:1px solid var(--border);padding:8px 2px;background:transparent;text-align:left;cursor:pointer;color:var(--navy)"><span style="font-size:11px;font-weight:700">${esc(r.client)}<small style="display:block;color:var(--muted);font-weight:400">${esc(r.source)}</small></span><b style="font-size:11px;color:#b42318;white-space:nowrap">${money(r.currency,r.outstanding)}</b></button>`).join('')||'<div style="font-size:11px;color:var(--muted);padding:7px 0">No outstanding client fees.</div>'}</div>`;
    host.onclick=e=>{const b=e.target.closest('[data-v16-kind]');if(b&&typeof fdOpenReceivableSourceV2==='function')fdOpenReceivableSourceV2(b.dataset.v16Kind,b.dataset.v16Id)};
  }

  function renderRevenueAnalytics(){ }

  function renderCollectionHealth(){ }

  function renderAttention(){ }

  function vatRecognitionDate(i){
    const firstReceipt=receipts(i)
      .filter(r=>num(r.cash)+num(r.wht)>0&&r.date)
      .map(r=>r.date)
      .sort()[0];
    return firstReceipt||date(i.invoice_date);
  }

  function vatPosition(){
    const {start,end}=bounds(),{invoices}=data(),payable={TZS:0},pipeline={TZS:0};
    let taxInvoiceCount=0,proformaCount=0;
    invoices.forEach(i=>{
      const amount=Math.max(0,num(i.vat_amount)),type=String(i.invoice_type||'').toLowerCase(),status=String(i.status||'').toLowerCase();
      if(type==='tax'&&!['draft','void','cancelled','superseded'].includes(status)){
        const recognitionDate=vatRecognitionDate(i);
        if(amount>0&&recognitionDate>=start&&recognitionDate<=end){
          add(payable,i.currency,amount);taxInvoiceCount++;
        }
      }else if(type==='proforma'&&status==='issued'&&amount>0&&date(i.invoice_date)>=start&&date(i.invoice_date)<=end){
        add(pipeline,i.currency,amount);proformaCount++;
      }
    });
    return {payable,pipeline,taxInvoiceCount,proformaCount};
  }

  function renderObligations(){ }

  function renderStatus(){
    const text=q('fdStatusText');if(text)text.textContent=`Financial Dashboard · ${typeof fdPeriodLabel==='function'?fdPeriodLabel():'Selected period'}`;
    const box=q('fdStatusIndicator');if(box){box.style.color='#1d4ed8';box.style.background='#eff6ff'}
    const intel=q('fdIntelligence');if(intel)intel.textContent='Revenue and receivables retain invoice integration. Expense totals use posted manual transactions only. Cash is net recorded movement, not a verified bank balance.';
  }

  function render(){
    if(rendering)return;rendering=true;
    try{
      renderKpis();renderReceivables();renderRevenueAnalytics();renderCollectionHealth();renderAttention();renderObligations();renderStatus();
      ['fdRevByType','fdRevByClient','fdRevByPractice','fdRevByPartner','fdClientMatterRevenueV2','fdAlerts','fdMonthlyObligationsStableV6','fdMonthlyObligations'].forEach(id=>{
        const el=q(id);if(!el)return;let node=el;
        for(let i=0;i<4&&node.parentElement;i++){const p=node.parentElement;if(p.tagName==='SECTION'||/card|panel|widget/i.test(String(p.className||''))){node=p;break}node=p}
        node.style.display='none';
      });
    }finally{rendering=false}
  }

  async function loadPayments(){
    try{if(typeof sb==='undefined'||!sb)return;const {data:rows,error}=await sb.from('invoice_payments').select('id,invoice_id,payment_date,cash_amount,withholding_tax_amount,reference,created_at');if(error)throw error;paymentRows=rows||[]}catch(e){console.warn('[MOLMS finance V16 payments]',e)}
  }

  async function refresh(){await loadPayments();render();setTimeout(render,30);setTimeout(render,180)}
  const baseRefresh=window.fdRefresh;
  if(typeof baseRefresh==='function')window.fdRefresh=async function(){const result=await baseRefresh.apply(this,arguments);await refresh();return result};
  window.addEventListener('load',()=>{setTimeout(refresh,900);setTimeout(refresh,1800)});
  // The legacy application renders again after authentication and after its
  // asynchronous financial queries complete. Reconcile after those paints so
  // the canonical figures cannot be replaced by the old dashboard output.
  let lastDataSignature='';
  setInterval(()=>{
    const kpi=q('fdKpiRow'),client=q('fdClientMatterRevenueV2');
    if(!kpi&&!client)return;
    const d=data();
    const signature=[d.invoices.length,d.manual.length,d.entries.length,d.payroll.length,d.office.length,bounds().start,bounds().end].join('|');
    const legacyVisible=(kpi&&/OUTSTANDING PAYMENTS/.test(kpi.textContent||''))||(client&&/CLIENT\s*&\s*MATTER REVENUE/.test(client.textContent||''));
    if(legacyVisible)render();
    if(signature!==lastDataSignature){lastDataSignature=signature;refresh()}
  },500);
  let reconcileQueued=false;
  if(typeof MutationObserver!=='undefined')new MutationObserver(()=>{
      const kpi=q('fdKpiRow'),client=q('fdClientMatterRevenueV2');
      const legacyVisible=(kpi&&/OUTSTANDING PAYMENTS/.test(kpi.textContent||''))||(client&&/CLIENT\s*&\s*MATTER REVENUE/.test(client.textContent||''));
      if(!legacyVisible||reconcileQueued)return;
      reconcileQueued=true;
      queueMicrotask(()=>{reconcileQueued=false;render()});
    }).observe(document.documentElement,{childList:true,subtree:true});
  window.MOLMSFinanceV16={metrics,periodClientRows,allReceivables,render,refresh,audit:()=>{const m=metrics();return {version:16,period:bounds(),revenue:m.revenue,collected:m.collected,newReceivables:m.newReceivables,totalReceivables:m.totalReceivables,cash:m.cash.closingByCur,vat:vatPosition(),paymentLedgerRows:paymentRows.length}}};
})();