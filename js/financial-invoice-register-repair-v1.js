/* MOLMS Invoice Register + Carried-Forward Receivables V2
 * Issued invoice register for the selected month; open receivables carried forward
 * from any prior month until the balance is fully settled.
 */
(function(){
'use strict';
if(window.MOLMSInvoiceRegisterRepairV1&&window.MOLMSInvoiceRegisterRepairV1.version>=2)return;
window.MOLMSInvoiceRegisterRepairV1={version:2,loaded:false};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').trim().toLowerCase();
const money=(v,c)=>((c||'TZS')==='USD'?'USD ':'TZS ')+Number(v||0).toLocaleString('en-US',{maximumFractionDigits:2});
function period(){
 const page=document.getElementById('page-findash');
 const sels=page?Array.from(page.querySelectorAll('select')):[];
 const sel=sels.find(s=>/202\d/.test(String(s.value||'')));
 const raw=String(sel&&sel.value||'');
 const m=raw.match(/(20\d{2})[^0-9]?([01]?\d)/);
 if(!m){const d=new Date(),y=d.getFullYear(),mo=d.getMonth()+1;return makePeriod(y,mo,true);}
 const y=Number(m[1]),mo=Number(m[2]);return mo>=1&&mo<=12?makePeriod(y,mo,false):null;
}
function makePeriod(y,mo,current){
 const start=y+'-'+String(mo).padStart(2,'0')+'-01';
 const last=new Date(Date.UTC(y,mo,0)).toISOString().slice(0,10);
 const today=new Date().toISOString().slice(0,10);
 return {start,end:current&&today<last?today:last,label:new Date(Date.UTC(y,mo-1,1)).toLocaleString('en-US',{month:'long',year:'numeric',timeZone:'UTC'})};
}
function page(){return document.getElementById('page-findash');}
function findReceivableCard(){
 const p=page();if(!p)return null;
 return Array.from(p.querySelectorAll('div,section,article')).find(e=>e.children.length<7&&norm(e.textContent).includes('total client receivables')&&norm(e.textContent).length<400);
}
function ensureRegisterHost(){
 const p=page();if(!p)return null;
 let h=p.querySelector('#molms-invoice-register-v1');if(h)return h;
 h=document.createElement('section');h.id='molms-invoice-register-v1';
 h.style.cssText='margin:12px 20px 18px;background:#fff;border:1px solid #e3d8ca;border-radius:14px;padding:16px;overflow:auto';
 const scroll=Array.from(p.children).find(el=>/overflow-y:\s*auto/i.test(el.getAttribute('style')||''))||p;
 const priority=p.querySelector('#fdPriorityRowV7')||Array.from(p.querySelectorAll('div')).find(e=>norm(e.textContent).trim()==='management priorities');
 if(priority&&priority.parentElement===scroll)priority.insertAdjacentElement('afterend',h);else scroll.appendChild(h);
 return h;
}
function paintReceivables(open,periodInfo){
 const p=page(),card=findReceivableCard();if(!p||!card)return;
 const currencies=[...new Set(open.map(r=>r.currency||'TZS'))];
 const sums={};open.forEach(r=>{const c=r.currency||'TZS';sums[c]=(sums[c]||0)+r.outstanding;});
 const tzs=sums.TZS||0;
 card.innerHTML='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div><div style="font-size:13px;font-weight:800;letter-spacing:.3px;color:#102a43">OPEN CLIENT RECEIVABLES</div><div style="font-size:12px;color:#667085;margin-top:4px">Unpaid balances carried forward through '+esc(periodInfo.end)+'. Closed invoices disappear after full settlement.</div></div><div style="text-align:right"><div style="font-size:11px;color:#667085">Open invoices</div><div style="font-size:18px;font-weight:800;color:#102a43">'+open.length+'</div></div></div>'+
 '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">'+currencies.map(c=>'<div style="border:1px solid #e3d8ca;border-radius:9px;background:#faf8f4;padding:9px 12px;min-width:155px"><div style="font-size:10px;font-weight:800;color:#667085">'+esc(c)+' OUTSTANDING</div><div style="font-size:18px;font-weight:800;color:#b45309;margin-top:3px">'+money(sums[c],c)+'</div></div>').join('')+'</div>'+
 (open.length?'<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:740px;font-size:12px"><thead><tr style="background:#f1f5f9;text-align:left"><th style="padding:9px">Client / Invoice</th><th style="padding:9px">Issued</th><th style="padding:9px">Invoice total</th><th style="padding:9px">Paid / WHT</th><th style="padding:9px">Balance due</th><th style="padding:9px">Status</th></tr></thead><tbody>'+open.map(r=>'<tr style="border-bottom:1px solid #edf0f2"><td style="padding:9px"><b>'+esc(r.client_name||'Client not specified')+'</b><div style="font-size:11px;color:#667085;margin-top:3px">'+esc(r.invoice_number||'—')+(r.matter_ref?' · '+esc(r.matter_ref):'')+'</div></td><td style="padding:9px;white-space:nowrap">'+esc(r.invoice_date||'—')+'</td><td style="padding:9px;white-space:nowrap">'+money(r.total_due,r.currency)+'</td><td style="padding:9px;white-space:nowrap">'+money(r.paid+r.wht,r.currency)+(r.wht>0?'<div style="font-size:10px;color:#667085">WHT '+money(r.wht,r.currency)+'</div>':'')+'</td><td style="padding:9px;font-weight:800;color:#b45309;white-space:nowrap">'+money(r.outstanding,r.currency)+'</td><td style="padding:9px;font-weight:700;color:'+(r.state==='Partially Paid'?'#b45309':'#b91c1c')+'">'+r.state+'</td></tr>').join('')+'</tbody></table></div>':'<div style="padding:14px;background:#f0fdf4;border-radius:9px;color:#166534;font-size:12px">No outstanding client invoices at this reporting date. Fully paid invoices are closed and no longer appear here.</div>');
}
async function render(){
 const h=ensureRegisterHost();if(!h)return;
 if(typeof sb==='undefined'||!sb){h.innerHTML='<b>Invoice Register</b><p style="color:#667085">Waiting for secure financial data connection…</p>';return;}
 const p=period();if(!p){h.innerHTML='<b>Invoice Register</b><p>Select a valid reporting month.</p>';return;}
 h.innerHTML='<b>Invoice Register · '+esc(p.label)+'</b><p style="color:#667085">Loading invoice and payment records…</p>';
 try{
  const {data:issued,error}=await sb.from('invoices').select('id,invoice_number,client_name,matter_ref,matter_title,currency,invoice_date,due_date,total_due,amount_paid,withholding_tax_amount,status,invoice_type,voided_at').eq('invoice_type','tax').lte('invoice_date',p.end).order('invoice_date',{ascending:false});
  if(error)throw error;
  const eligible=(issued||[]).filter(i=>!i.voided_at&&!['draft','void','cancelled','superseded'].includes(norm(i.status)));
  const ids=eligible.map(r=>r.id);let pays=[];
  if(ids.length){const result=await sb.from('invoice_payments').select('invoice_id,payment_date,cash_amount,withholding_tax_amount').in('invoice_id',ids).lte('payment_date',p.end);if(result.error)throw result.error;pays=result.data||[];}
  const totals={};pays.forEach(x=>{const t=totals[x.invoice_id]||(totals[x.invoice_id]={cash:0,wht:0});t.cash+=Number(x.cash_amount||0);t.wht+=Number(x.withholding_tax_amount||0);});
  eligible.forEach(r=>{const t=totals[r.id];r.paid=t?t.cash:Number(r.amount_paid||0);r.wht=t?t.wht:Number(r.withholding_tax_amount||0);r.outstanding=Math.max(0,Number(r.total_due||0)-r.paid-r.wht);r.state=r.outstanding<=0?'Fully Paid':r.paid+r.wht>0?'Partially Paid':'Unpaid';});
  const monthly=eligible.filter(r=>r.invoice_date>=p.start&&r.invoice_date<=p.end);
  const open=eligible.filter(r=>r.outstanding>0).sort((a,b)=>a.invoice_date.localeCompare(b.invoice_date));
  paintReceivables(open,p);
  const sum={};monthly.forEach(r=>{const c=r.currency||'TZS';sum[c]=sum[c]||{total:0,paid:0,out:0};sum[c].total+=Number(r.total_due||0);sum[c].paid+=r.paid+r.wht;sum[c].out+=r.outstanding;});
  const summaries=Object.keys(sum).map(c=>'<span style="display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin:6px 6px 8px 0;font-size:12px"><b>'+esc(c)+'</b> · Issued '+money(sum[c].total,c)+' · Paid / WHT '+money(sum[c].paid,c)+' · Balance due '+money(sum[c].out,c)+'</span>').join('');
  const body=monthly.length?monthly.map(r=>'<tr style="border-bottom:1px solid #edf0f2"><td style="padding:9px">'+esc(r.invoice_number||'—')+'</td><td style="padding:9px">'+esc(r.client_name||'—')+'<div style="color:#667085;font-size:11px">'+esc([r.matter_ref,r.matter_title].filter(Boolean).join(' · '))+'</div></td><td style="padding:9px">'+esc(r.invoice_date||'—')+'</td><td style="padding:9px;white-space:nowrap">'+money(r.total_due,r.currency)+'</td><td style="padding:9px;white-space:nowrap">'+money(r.paid+r.wht,r.currency)+'</td><td style="padding:9px;font-weight:700;white-space:nowrap">'+money(r.outstanding,r.currency)+'</td><td style="padding:9px;font-weight:700;color:'+(r.state==='Fully Paid'?'#15803d':r.state==='Partially Paid'?'#b45309':'#b91c1c')+'">'+r.state+'</td></tr>').join(''):'<tr><td colspan="7" style="padding:16px;color:#667085">No issued tax invoices for this month.</td></tr>';
  h.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><div style="font-size:16px;font-weight:800;color:#102a43">Invoice Register</div><div style="font-size:12px;color:#667085;margin-top:3px">Invoices issued in '+esc(p.label)+'. Prior-month unpaid balances remain in Open Client Receivables above until settled.</div></div><div style="font-size:12px;font-weight:700">'+monthly.length+' invoice(s) issued</div></div><div style="margin-top:8px">'+summaries+'</div><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:820px"><thead><tr style="background:#f1f5f9;text-align:left"><th style="padding:9px">Invoice</th><th style="padding:9px">Client / Matter</th><th style="padding:9px">Issued</th><th style="padding:9px">Invoice Total</th><th style="padding:9px">Paid / WHT</th><th style="padding:9px">Balance due</th><th style="padding:9px">Status</th></tr></thead><tbody>'+body+'</tbody></table></div><div style="font-size:11px;color:#667085;margin-top:8px">Paid amounts use recorded cash payments and withholding tax through '+esc(p.end)+'. Proformas, drafts, voided and superseded invoices are excluded.</div>';
  window.MOLMSInvoiceRegisterRepairV1.loaded=true;window.MOLMSInvoiceRegisterRepairV1.audit={period:p,monthlyCount:monthly.length,openCount:open.length,open,monthly};
 }catch(e){console.error('[MOLMS invoice register V2]',e);h.innerHTML='<b>Invoice Register</b><p style="color:#b91c1c">Could not load invoice data. Check permissions and refresh.</p>';}
}
let lastKey='';let busy=false;
async function safeRender(){if(busy)return;busy=true;try{await render();const p=period();lastKey=p&&p.start+'|'+p.end||'';}finally{busy=false;}}
function start(){setTimeout(safeRender,450);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.addEventListener('load',start);
setInterval(()=>{const p=period(),key=p&&p.start+'|'+p.end||'';if(key&&key!==lastKey)safeRender();},1500);
})();