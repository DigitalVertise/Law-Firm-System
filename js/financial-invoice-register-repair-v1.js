/* MOLMS Receivables + Invoice Register V3 — robust placement and cross-month balance */
(function(){
'use strict';
window.MOLMSInvoiceRegisterRepairV1={version:3,loaded:false};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').trim().toLowerCase();
const money=(v,c)=>((c||'TZS')==='USD'?'USD ':'TZS ')+Number(v||0).toLocaleString('en-US',{maximumFractionDigits:2});
function getPeriod(){
 const p=document.getElementById('page-findash');const sels=p?[...p.querySelectorAll('select')]:[];
 let s=sels.find(x=>/20\d{2}/.test(String(x.value||'')));let raw=String(s&&s.value||'');
 let m=raw.match(/(20\d{2})[^0-9]?([01]?\d)/);
 if(!m){let d=new Date();return periodOf(d.getFullYear(),d.getMonth()+1,true);}
 let y=+m[1],mo=+m[2];return mo>=1&&mo<=12?periodOf(y,mo,false):null;
}
function periodOf(y,mo,current){let start=y+'-'+String(mo).padStart(2,'0')+'-01',last=new Date(Date.UTC(y,mo,0)).toISOString().slice(0,10),today=new Date().toISOString().slice(0,10);return {start,end:current&&today<last?today:last,label:new Date(Date.UTC(y,mo-1,1)).toLocaleString('en-US',{month:'long',year:'numeric',timeZone:'UTC'})};}
function getScroll(){let p=document.getElementById('page-findash');return p&&([...p.children].find(x=>/overflow-y:\s*auto/i.test(x.getAttribute('style')||''))||p);}
function getCard(){let p=document.getElementById('page-findash');if(!p)return null;return [...p.querySelectorAll('div,section,article')].filter(e=>e.children.length<8&&norm(e.textContent).includes('total client receivables')&&norm(e.textContent).length<500).sort((a,b)=>a.textContent.length-b.textContent.length)[0]||null;}
function ensure(id,style){let p=document.getElementById('page-findash'),el=p&&p.querySelector('#'+id);if(el)return el;el=document.createElement('section');el.id=id;el.style.cssText=style;return el;}
function placeRegister(h){const p=document.getElementById('page-findash');if(!p)return;const scroll=getScroll();const quick=p.querySelector('.fd-simple-quick-actions');const priority=p.querySelector('#fdPriorityRowV7');const anchor=quick||priority;if(anchor&&anchor.parentElement){anchor.insertAdjacentElement('afterend',h);}else scroll.insertBefore(h,scroll.children[2]||null);}
function paintReceivables(rows,asof){
 const card=getCard();if(!card)return;
 const sums={};rows.forEach(r=>{let c=r.currency||'TZS';sums[c]=(sums[c]||0)+r.outstanding;});
 const currencies=Object.keys(sums).sort((a,b)=>a==='TZS'?-1:b==='TZS'?1:a.localeCompare(b));
 const body=rows.length?rows.map(r=>'<tr style="border-bottom:1px solid #edf0f2"><td style="padding:9px"><b>'+esc(r.client_name||'Client not specified')+'</b><div style="font-size:11px;color:#667085">'+esc(r.invoice_number||'—')+(r.matter_ref?' · '+esc(r.matter_ref):'')+'</div></td><td style="padding:9px;white-space:nowrap">'+esc(r.invoice_date||'—')+'</td><td style="padding:9px;white-space:nowrap">'+money(r.total_due,r.currency)+'</td><td style="padding:9px;white-space:nowrap">'+money(r.paid+r.wht,r.currency)+'</td><td style="padding:9px;font-weight:800;color:#b45309;white-space:nowrap">'+money(r.outstanding,r.currency)+'</td><td style="padding:9px;color:'+(r.state==='Partially Paid'?'#b45309':'#b91c1c')+';font-weight:700">'+r.state+'</td></tr>').join(''):'<tr><td colspan="6" style="padding:14px;color:#166534">No outstanding invoices as of '+esc(asof)+'. Fully paid invoices are removed from this list.</td></tr>';
 card.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-size:13px;font-weight:800;letter-spacing:.3px;color:#102a43">TOTAL CLIENT RECEIVABLES</div><div style="font-size:12px;color:#667085;margin-top:4px">All unpaid issued tax invoices through '+esc(asof)+'. Prior-month balances carry forward automatically until fully settled.</div></div><div style="text-align:right"><div style="font-size:11px;color:#667085">Open invoices</div><div style="font-size:18px;font-weight:800;color:#102a43">'+rows.length+'</div></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">'+currencies.map(c=>'<div style="border:1px solid #e3d8ca;border-radius:9px;background:#faf8f4;padding:9px 12px;min-width:160px"><div style="font-size:10px;font-weight:800;color:#667085">'+esc(c)+' OUTSTANDING</div><div style="font-size:18px;font-weight:800;color:#b45309;margin-top:3px">'+money(sums[c],c)+'</div></div>').join('')+'</div>'+(rows.length?'<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:740px;font-size:12px"><thead><tr style="background:#f1f5f9;text-align:left"><th style="padding:9px">Client / Invoice</th><th style="padding:9px">Issued</th><th style="padding:9px">Invoice total</th><th style="padding:9px">Paid incl. WHT</th><th style="padding:9px">Balance due</th><th style="padding:9px">Status</th></tr></thead><tbody>'+body+'</tbody></table></div>':'<div style="padding:10px;background:#f0fdf4;border-radius:8px;font-size:12px">No open client balances at this reporting date.</div>');
}
async function render(){
 const p=getPeriod(),scroll=getScroll();if(!p||!scroll)return;
 let reg=ensure('molms-invoice-register-v1','display:block;margin:12px 20px 18px;background:#fff;border:1px solid #e3d8ca;border-radius:14px;padding:16px;overflow:auto');
 if(!reg.isConnected)placeRegister(reg);
 if(typeof sb==='undefined'||!sb){reg.innerHTML='<b>Invoice Register</b><p style="color:#b91c1c">Financial data connection unavailable.</p>';return;}
 reg.innerHTML='<b>Invoice Register · '+esc(p.label)+'</b><p style="color:#667085">Loading invoice records…</p>';
 try{
  const q=await sb.from('invoices').select('id,invoice_number,client_name,matter_ref,matter_title,currency,invoice_date,due_date,total_due,amount_paid,withholding_tax_amount,status,invoice_type,voided_at').eq('invoice_type','tax').lte('invoice_date',p.end).order('invoice_date',{ascending:false});
  if(q.error)throw q.error;
  const all=(q.data||[]).filter(r=>!r.voided_at&&!['draft','void','cancelled','superseded'].includes(norm(r.status)));
  const ids=all.map(r=>r.id);let payments=[];
  for(let i=0;i<ids.length;i+=100){const z=await sb.from('invoice_payments').select('invoice_id,payment_date,cash_amount,withholding_tax_amount').in('invoice_id',ids.slice(i,i+100)).lte('payment_date',p.end);if(z.error)throw z.error;payments.push(...(z.data||[]));}
  const ledger={};payments.forEach(x=>{let t=ledger[x.invoice_id]||(ledger[x.invoice_id]={cash:0,wht:0});t.cash+=Number(x.cash_amount||0);t.wht+=Number(x.withholding_tax_amount||0);});
  all.forEach(r=>{let t=ledger[r.id];r.paid=t?t.cash:Number(r.amount_paid||0);r.wht=t?t.wht:Number(r.withholding_tax_amount||0);r.outstanding=Math.max(0,Number(r.total_due||0)-r.paid-r.wht);r.state=r.outstanding<=0?'Fully Paid':r.paid+r.wht>0?'Partially Paid':'Unpaid';});
  const open=all.filter(r=>r.outstanding>0).sort((a,b)=>String(a.invoice_date).localeCompare(String(b.invoice_date)));
  paintReceivables(open,p.end);
  const month=all.filter(r=>r.invoice_date>=p.start&&r.invoice_date<=p.end);
  const sums={};month.forEach(r=>{let c=r.currency||'TZS';sums[c]=sums[c]||{total:0,paid:0,out:0};sums[c].total+=Number(r.total_due||0);sums[c].paid+=r.paid+r.wht;sums[c].out+=r.outstanding;});
  const summary=Object.keys(sums).map(c=>'<div style="display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin:6px 6px 8px 0;font-size:12px"><b>'+esc(c)+'</b> · Issued '+money(sums[c].total,c)+' · Paid incl. WHT '+money(sums[c].paid,c)+' · Balance due '+money(sums[c].out,c)+'</div>').join('');
  const trs=month.length?month.map(r=>'<tr style="border-bottom:1px solid #edf0f2"><td style="padding:9px">'+esc(r.invoice_number||'—')+'</td><td style="padding:9px">'+esc(r.client_name||'—')+'<div style="font-size:11px;color:#667085">'+esc([r.matter_ref,r.matter_title].filter(Boolean).join(' · '))+'</div></td><td style="padding:9px;white-space:nowrap">'+esc(r.invoice_date||'—')+'</td><td style="padding:9px;white-space:nowrap">'+money(r.total_due,r.currency)+'</td><td style="padding:9px;white-space:nowrap">'+money(r.paid+r.wht,r.currency)+'</td><td style="padding:9px;font-weight:700;white-space:nowrap">'+money(r.outstanding,r.currency)+'</td><td style="padding:9px;color:'+(r.state==='Fully Paid'?'#15803d':r.state==='Partially Paid'?'#b45309':'#b91c1c')+';font-weight:700">'+r.state+'</td></tr>').join(''):'<tr><td colspan="7" style="padding:14px;color:#667085">No issued tax invoices in this month.</td></tr>';
  reg.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><div style="font-size:16px;font-weight:800;color:#102a43">Invoice Register</div><div style="font-size:12px;color:#667085;margin-top:3px">Issued in '+esc(p.label)+'. Outstanding balances from all prior months are listed above.</div></div><b>'+month.length+' invoice(s)</b></div><div style="margin-top:8px">'+summary+'</div><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:820px"><thead><tr style="background:#f1f5f9;text-align:left"><th style="padding:9px">Invoice</th><th style="padding:9px">Client / Matter</th><th style="padding:9px">Issued</th><th style="padding:9px">Total</th><th style="padding:9px">Paid incl. WHT</th><th style="padding:9px">Balance due</th><th style="padding:9px">Status</th></tr></thead><tbody>'+trs+'</tbody></table></div><div style="font-size:11px;color:#667085;margin-top:8px">Only issued tax invoices are included. Proformas, drafts, voided and superseded invoices are excluded.</div>';
  window.MOLMSInvoiceRegisterRepairV1.loaded=true;window.MOLMSInvoiceRegisterRepairV1.audit={period:p,allCount:all.length,openCount:open.length,open,month};
 }catch(e){console.error('[MOLMS receivables V3]',e);reg.innerHTML='<b>Invoice Register</b><p style="color:#b91c1c">Could not load invoice records: '+esc(e.message||e)+'</p>';}
}
let busy=false,last='';async function run(){if(busy)return;busy=true;try{await render();let p=getPeriod();last=p&&p.start+'|'+p.end||'';}finally{busy=false;}}
function start(){setTimeout(run,500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.addEventListener('load',start);
setInterval(()=>{let p=getPeriod(),k=p&&p.start+'|'+p.end||'';if(k&&k!==last)run();},2000);
})();