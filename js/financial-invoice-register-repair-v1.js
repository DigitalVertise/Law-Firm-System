/* MOLMS Invoice Register + Receivables Repair V1
 * Reads issued tax invoices and their payment ledger; presentation-only.
 */
(function(){
  'use strict';
  if(window.MOLMSInvoiceRegisterRepairV1) return;
  window.MOLMSInvoiceRegisterRepairV1={version:1,loaded:false};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(v,c)=> (c==='USD'?'USD ':'TZS ')+Number(v||0).toLocaleString('en-US',{maximumFractionDigits:2});
  const norm=s=>String(s||'').toLowerCase();
  function period(){
    const page=document.getElementById('page-findash');
    const sel=page&&Array.from(page.querySelectorAll('select')).find(s=>/202[0-9]/.test(s.value||''));
    const raw=sel&&sel.value||'';
    let m=raw.match(/(20\d{2})[^0-9]?([01]?\d)/);
    if(!m){const d=new Date();return {start:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01',end:d.toISOString().slice(0,10),label:d.toLocaleString('en-US',{month:'long',year:'numeric'})};}
    const y=Number(m[1]),mo=Number(m[2]);if(mo<1||mo>12)return null;
    const start=y+'-'+String(mo).padStart(2,'0')+'-01';
    const end=new Date(Date.UTC(y,mo,0)).toISOString().slice(0,10);
    return {start,end,label:new Date(Date.UTC(y,mo-1,1)).toLocaleString('en-US',{month:'long',year:'numeric',timeZone:'UTC'})};
  }
  function host(){
    const page=document.getElementById('page-findash');if(!page)return null;
    let h=page.querySelector('#molms-invoice-register-v1');if(h)return h;
    h=document.createElement('section');h.id='molms-invoice-register-v1';
    h.style.cssText='margin:12px 20px 18px;background:#fff;border:1px solid #e3d8ca;border-radius:14px;padding:16px;overflow:auto';
    const title=Array.from(page.querySelectorAll('h2,h3,div')).find(e=>norm(e.textContent).trim()==='management priorities');
    if(title&&title.parentElement)title.parentElement.insertBefore(h,title.nextSibling);else{
      const scroll=Array.from(page.children).find(el=>/overflow-y:\s*auto/i.test(el.getAttribute('style')||''))||page;
      scroll.insertBefore(h,scroll.children[2]||null);
    }
    return h;
  }
  function updateReceivables(rows){
    const totalByCurrency={};
    rows.forEach(r=>{const out=Math.max(0,Number(r.total_due||0)-Number(r.paid||0)-Number(r.wht||0));if(out>0)totalByCurrency[r.currency]=(totalByCurrency[r.currency]||0)+out;});
    const page=document.getElementById('page-findash');if(!page)return;
    const nodes=Array.from(page.querySelectorAll('div,section,article'));
    const label=nodes.find(e=>e.children.length<5&&norm(e.textContent).includes('total client receivables')&&norm(e.textContent).length<180);
    if(label){
      let amount=label.querySelector('[data-molms-receivables-total]');
      if(!amount){amount=Array.from(label.querySelectorAll('div,strong,b')).find(e=>/^TZS\s*0(?:\.0+)?$/.test(e.textContent.trim()));}
      if(amount){amount.textContent=money(totalByCurrency.TZS||0,'TZS');amount.setAttribute('data-molms-receivables-total','true');}
      let note=Array.from(label.querySelectorAll('*')).find(e=>norm(e.textContent).includes('no open receivables'));
      if(note)note.textContent=(totalByCurrency.TZS||0)>0?'Outstanding balance from issued tax invoices.':'No open TZS receivables as at this date.';
    }
  }
  async function render(){
    const h=host();if(!h)return;
    if(typeof sb==='undefined'||!sb){h.innerHTML='<b>Invoice Register</b><p style="color:#667085">Waiting for secure financial data connection…</p>';return;}
    const p=period();if(!p){h.innerHTML='<b>Invoice Register</b><p>Select a valid reporting month.</p>';return;}
    h.innerHTML='<b>Invoice Register · '+esc(p.label)+'</b><p style="color:#667085">Loading issued tax invoices…</p>';
    try{
      const {data:inv,error}=await sb.from('invoices').select('id,invoice_number,client_name,matter_ref,matter_title,currency,invoice_date,due_date,total_due,amount_paid,withholding_tax_amount,status,invoice_type,voided_at').eq('invoice_type','tax').gte('invoice_date',p.start).lte('invoice_date',p.end).order('invoice_date',{ascending:false});
      if(error)throw error;
      const rows=(inv||[]).filter(i=>!i.voided_at&&!['draft','void','cancelled','superseded'].includes(norm(i.status)));
      const ids=rows.map(r=>r.id);let pays=[];
      if(ids.length){const result=await sb.from('invoice_payments').select('invoice_id,cash_amount,withholding_tax_amount').in('invoice_id',ids);if(result.error)throw result.error;pays=result.data||[];}
      const totals={};pays.forEach(x=>{const t=totals[x.invoice_id]||(totals[x.invoice_id]={cash:0,wht:0});t.cash+=Number(x.cash_amount||0);t.wht+=Number(x.withholding_tax_amount||0);});
      rows.forEach(r=>{const t=totals[r.id]||{cash:Number(r.amount_paid||0),wht:Number(r.withholding_tax_amount||0)};r.paid=t.cash;r.wht=t.wht;const settled=t.cash+t.wht;r.outstanding=Math.max(0,Number(r.total_due||0)-settled);r.state=r.outstanding<=0?'Fully Paid':settled>0?'Partially Paid':'Unpaid';});
      updateReceivables(rows);
      const sum={};rows.forEach(r=>{const c=r.currency||'TZS';sum[c]=sum[c]||{total:0,paid:0,out:0};sum[c].total+=Number(r.total_due||0);sum[c].paid+=r.paid;sum[c].out+=r.outstanding;});
      const summaries=Object.keys(sum).map(c=>'<span style="display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin:6px 6px 8px 0;font-size:12px"><b>'+esc(c)+'</b> · Issued '+money(sum[c].total,c)+' · Settled '+money(sum[c].paid,c)+' · Outstanding '+money(sum[c].out,c)+'</span>').join('');
      const body=rows.length?rows.map(r=>'<tr><td>'+esc(r.invoice_number||'—')+'</td><td>'+esc(r.client_name||'—')+'<div style="color:#667085;font-size:11px">'+esc([r.matter_ref,r.matter_title].filter(Boolean).join(' · '))+'</div></td><td>'+esc(r.invoice_date||'—')+'</td><td>'+money(r.total_due,r.currency)+'</td><td>'+money(r.paid,r.currency)+'</td><td>'+money(r.outstanding,r.currency)+'</td><td><span style="font-weight:700;color:'+(r.state==='Fully Paid'?'#15803d':r.state==='Partially Paid'?'#b45309':'#b91c1c')+'">'+r.state+'</span></td></tr>').join(''):'<tr><td colspan="7" style="padding:16px;color:#667085">No issued tax invoices for this month.</td></tr>';
      h.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><div style="font-size:16px;font-weight:800;color:#102a43">Invoice Register</div><div style="font-size:12px;color:#667085;margin-top:3px">Every issued tax invoice for '+esc(p.label)+', including payment and outstanding position.</div></div><div style="font-size:12px;font-weight:700">'+rows.length+' invoice(s)</div></div><div style="margin-top:8px">'+summaries+'</div><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:820px"><thead><tr style="background:#f1f5f9;text-align:left"><th style="padding:9px">Invoice</th><th style="padding:9px">Client / Matter</th><th style="padding:9px">Issued</th><th style="padding:9px">Invoice Total</th><th style="padding:9px">Paid</th><th style="padding:9px">Outstanding</th><th style="padding:9px">Status</th></tr></thead><tbody>'+body+'</tbody></table></div><div style="font-size:11px;color:#667085;margin-top:8px">Payments include recorded withholding tax. Proformas, drafts, voided and superseded invoices are excluded.</div>';
      window.MOLMSInvoiceRegisterRepairV1.loaded=true;window.MOLMSInvoiceRegisterRepairV1.audit={period:p,count:rows.length,rows};
    }catch(e){console.error('[MOLMS invoice register]',e);h.innerHTML='<b>Invoice Register</b><p style="color:#b91c1c">Could not load invoice data. Check permissions and refresh.</p>';}
  }
  let timer;function start(){clearTimeout(timer);timer=setTimeout(render,400);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.addEventListener('load',start);
  setInterval(()=>{const p=period();const key=p&&p.start+'|'+p.end;if(key!==window.MOLMSInvoiceRegisterRepairV1.periodKey){window.MOLMSInvoiceRegisterRepairV1.periodKey=key;render();}},1800);
})();