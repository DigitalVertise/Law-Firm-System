const assert = require('node:assert/strict');

global.window = global;
global.addEventListener = ()=>{};
global.setInterval = ()=>0;
global.setTimeout = ()=>0;
global.document = {getElementById(){return null},addEventListener(){}};
let selectedPeriod={start:'2026-09-01',end:'2026-09-13',monthStr:'2026-09'};
global.fdGetPeriodDates = ()=>selectedPeriod;
global.fdCashContinuity = ()=>({openingByCur:{TZS:358000},closingByCur:{TZS:1258000}});
global._fdAllEntries = [{date:'2026-09-05',amount:100000,status:'verified'}];
global._fdAllPayroll = [];
global._fdAllOfficeExpenses = [];
global._fdAllHistPayroll = [];
global._fdAllInvoices = [
  {id:'earsc',invoice_type:'tax',status:'part_paid',client_name:'Test client A',currency:'TZS',invoice_date:'2026-08-23',updated_at:'2026-08-27',total_due:7000000,amount_paid:3500000},
  {id:'hesu',invoice_type:'tax',status:'issued',client_name:'Test client B',currency:'TZS',invoice_date:'2026-08-26',total_due:1180000,amount_paid:0},
  {id:'zana',invoice_type:'tax',status:'paid',client_name:'Test client C',currency:'TZS',invoice_date:'2026-08-26',updated_at:'2026-08-27',total_due:708000,amount_paid:678000,withholding_tax_amount:30000},
  {id:'royal',invoice_type:'tax',status:'issued',client_name:'Test client D',currency:'TZS',invoice_date:'2026-08-27',total_due:1000000,amount_paid:0},
  {id:'settled-vat',invoice_type:'tax',status:'paid',client_name:'Test client E',currency:'TZS',invoice_date:'2026-08-30',updated_at:'2026-09-13',vat_amount:180000,total_due:1180000,amount_paid:1130000,withholding_tax_amount:50000},
  {id:'kaisa',invoice_type:'proforma',status:'issued',client_name:'Test proforma client',currency:'USD',invoice_date:'2026-09-01',vat_amount:540,total_due:3540,amount_paid:0},
  {id:'petra',invoice_type:'tax',status:'part_paid',client_name:'Test client F',currency:'TZS',invoice_date:'2026-09-02',updated_at:'2026-09-05',total_due:6000000,amount_paid:5000000,notes:'[Payment 2026-09-03] Cash 5,000,000 · Cash'},
  {id:'pacific',invoice_type:'tax',status:'issued',client_name:'Test client G',currency:'USD',invoice_date:'2026-09-07',total_due:250,amount_paid:0},
];
global._fdAllManual = [
  {id:'expense-test',status:'approved',tx_type:'expenditure',date:'2026-09-06',amount:25000,currency:'TZS'},
  {id:'b1',status:'approved',tx_type:'revenue',date:'2026-09-01',amount:1000000,currency:'TZS',client_receivable:true,agreed_amount:1200000,outstanding_amount:200000,receivable_client_name:'Test manual client A'},
  {id:'b2',status:'approved',tx_type:'revenue',date:'2026-09-03',amount:1000000,currency:'TZS',client_receivable:true,agreed_amount:2000000,outstanding_amount:1000000,receivable_client_name:'Test manual client A'},
  {id:'magnus',status:'approved',tx_type:'revenue',date:'2026-09-11',amount:3000000,currency:'TZS',client_receivable:true,agreed_amount:5000000,outstanding_amount:2000000,receivable_client_name:'Test manual client B'},
  {id:'mama',status:'approved',tx_type:'revenue',date:'2026-09-12',amount:1000000,currency:'TZS',client_receivable:true,agreed_amount:3000000,outstanding_amount:2000000,receivable_client_name:'Test manual client C'},
  {id:'d1',status:'approved',tx_type:'drawing',date:'2026-09-05',amount:1000000,currency:'TZS'},
  {id:'d2',status:'approved',tx_type:'drawing',date:'2026-09-05',amount:6000000,currency:'TZS'},
  {id:'d3',status:'approved',tx_type:'drawing',date:'2026-09-11',amount:3000000,currency:'TZS'}
];

require('../js/financial-dashboard-v16.js');
global.MOLMSFinanceV16.setPaymentRowsForTest([
  {id:'pay-earsc',invoice_id:'earsc',payment_date:'2026-08-27',cash_amount:3500000,withholding_tax_amount:0,payment_date_is_estimated:false,entry_origin:'manual'},
  {id:'pay-zana',invoice_id:'zana',payment_date:'2026-08-27',cash_amount:678000,withholding_tax_amount:30000,payment_date_is_estimated:false,entry_origin:'manual'},
  {id:'pay-vat',invoice_id:'settled-vat',payment_date:'2026-09-13',cash_amount:1130000,withholding_tax_amount:50000,payment_date_is_estimated:false,entry_origin:'manual'},
  {id:'pay-petra',invoice_id:'petra',payment_date:'2026-09-03',cash_amount:5000000,withholding_tax_amount:0,payment_date_is_estimated:false,entry_origin:'manual'}
]);
const audit=global.MOLMSFinanceV16.audit();
assert.deepEqual(audit.revenue,{TZS:17200000,USD:250});
assert.deepEqual(audit.collected,{TZS:6130000}); // verified cash only: Petra 5,000,000 + prior-period test invoice 1,130,000
assert.deepEqual(audit.newReceivables,{TZS:6200000,USD:250});
assert.deepEqual(audit.expenses,{TZS:25000});
assert.deepEqual(audit.totalReceivables,{TZS:11880000,USD:3790}); // includes the issued, unpaid proforma as a separately identified open commitment
assert.equal(global.MOLMSFinanceV16.allReceivables().find(r=>r.client==='Test proforma client').outstanding,3540);
assert.equal(global.MOLMSFinanceV16.allReceivables().find(r=>r.client==='Test proforma client').status,'Proforma Outstanding');
assert.deepEqual(audit.cash,{TZS:283000}); // ledger cash less approved manual cash outflows; no opening balance assumed
assert.deepEqual(audit.vat.payable,{TZS:180000});
assert.deepEqual(audit.withholdingTax,{TZS:50000});
assert.equal(audit.reconciliationIssues,0);
assert.equal(global.MOLMSFinanceV16.paymentIntegrity({id:'missing-ledger',amount_paid:500,withholding_tax_amount:0}).needsReconciliation,true);
assert.equal(global.MOLMSFinanceV16.paymentIntegrity({id:'estimated-ledger',amount_paid:500,withholding_tax_amount:0}).needsReconciliation,true);
assert.deepEqual(audit.vat.pipeline,{TZS:0,USD:540});
assert.equal(audit.vat.taxInvoiceCount,1);
assert.equal(audit.vat.proformaCount,1);
assert.equal(global.MOLMSFinanceV16.periodClientRows().find(r=>r.client==='Test manual client B').outstanding,2000000);

// October collections must follow payment dates even when the invoices were
// issued in September. Those receipts must not become October recognised revenue.
global._fdAllInvoices.push(
  {id:'test-oct-invoice-a',invoice_type:'tax',status:'paid',client_name:'Synthetic October test A',currency:'TZS',invoice_date:'2026-09-02',total_due:100,amount_paid:100},
  {id:'test-oct-invoice-b',invoice_type:'tax',status:'paid',client_name:'Synthetic October test B',currency:'TZS',invoice_date:'2026-09-08',total_due:200,amount_paid:200},
  {id:'test-oct-invoice-c',invoice_type:'tax',status:'paid',client_name:'Synthetic October test C',currency:'TZS',invoice_date:'2026-09-10',total_due:300,amount_paid:300}
);
global.MOLMSFinanceV16.setPaymentRowsForTest([
  {id:'pay-earsc',invoice_id:'earsc',payment_date:'2026-08-27',cash_amount:3500000,withholding_tax_amount:0,payment_date_is_estimated:false,entry_origin:'manual'},
  {id:'pay-zana',invoice_id:'zana',payment_date:'2026-08-27',cash_amount:678000,withholding_tax_amount:30000,payment_date_is_estimated:false,entry_origin:'manual'},
  {id:'pay-vat',invoice_id:'settled-vat',payment_date:'2026-09-13',cash_amount:1130000,withholding_tax_amount:50000,payment_date_is_estimated:false,entry_origin:'manual'},
  {id:'pay-petra',invoice_id:'petra',payment_date:'2026-09-03',cash_amount:5000000,withholding_tax_amount:0,payment_date_is_estimated:false,entry_origin:'manual'},
  {id:'pay-oct-a',invoice_id:'test-oct-invoice-a',payment_date:'2026-10-03',cash_amount:100,withholding_tax_amount:0,payment_date_is_estimated:false,entry_origin:'manual'},
  {id:'pay-oct-b',invoice_id:'test-oct-invoice-b',payment_date:'2026-10-08',cash_amount:200,withholding_tax_amount:0,payment_date_is_estimated:false,entry_origin:'manual'},
  {id:'pay-oct-c',invoice_id:'test-oct-invoice-c',payment_date:'2026-10-12',cash_amount:300,withholding_tax_amount:0,payment_date_is_estimated:false,entry_origin:'manual'}
]);
selectedPeriod={start:'2026-10-01',end:'2026-10-14',monthStr:'2026-10'};
const october=global.MOLMSFinanceV16.audit();
assert.deepEqual(october.collected,{TZS:600}); // synthetic ledger receipts only
assert.deepEqual(october.revenue,{TZS:0});
assert.deepEqual(october.newReceivables,{TZS:0});
assert.equal(october.reconciliationIssues,0);

// Expense policy regression: payroll, obligations and expenditure-register
// rows are operational records only. Partner-entered manual expenses alone
// feed Operating Expenses and reduce cash, exactly once.
global._fdAllEntries.push(
  {id:'auto-register-expense',date:'2026-10-05',amount:200000,status:'verified',tx_type:'expenditure'},
  {id:'auto-obligation',date:'2026-10-06',amount:300000,status:'approved',tx_type:'expenditure'}
);
global._fdAllPayroll.push(
  {id:'auto-payroll-expense',date:'2026-10-07',net_salary:1100000,total_employer_cost:1300000,status:'approved'}
);
global._fdAllOfficeExpenses.push(
  {id:'auto-office-expense',date:'2026-10-08',amount:200000,status:'approved'}
);
global._fdAllManual.push(
  {id:'manual-salary-payment',status:'approved',tx_type:'expenditure',date:'2026-10-07',amount:1100000,currency:'TZS',description:'Partner-recorded salary payment'},
  {id:'manual-utilities-payment',status:'approved',tx_type:'expenditure',date:'2026-10-08',amount:200000,currency:'TZS',description:'Partner-recorded utilities payment'},
  {id:'pending-expense-not-approved',status:'pending',tx_type:'expenditure',date:'2026-10-09',amount:900000,currency:'TZS'},
  {id:'cancelled-expense',status:'approved',tx_type:'expenditure',date:'2026-10-10',amount:800000,currency:'TZS',status_detail:'cancelled'}
);
global._fdAllManual[global._fdAllManual.length-1].status='cancelled';
const expensePolicy=global.MOLMSFinanceV16.audit();
assert.deepEqual(expensePolicy.expenses,{TZS:1300000}); // only the two approved partner-entered October expenses
assert.deepEqual(expensePolicy.cash,{TZS:-1016400}); // the same two expenses reduce cumulative verified cash movements once
assert.equal(expensePolicy.cash.TZS,283600-1100000-200000);


// An estimated payment date must not be counted as verified cash, but the
// recorded settlement still reduces the invoice balance for its issue month.
global.MOLMSFinanceV16.setPaymentRowsForTest([
  {id:'pay-earsc-estimated',invoice_id:'earsc',payment_date:'2026-08-27',cash_amount:3500000,withholding_tax_amount:0,payment_date_is_estimated:true,entry_origin:'legacy_reconciliation'}
]);
selectedPeriod={start:'2026-08-01',end:'2026-08-31',monthStr:'2026-08'};
const augustEstimatedSettlement=global.MOLMSFinanceV16.audit();
assert.deepEqual(augustEstimatedSettlement.newReceivables,{TZS:3500000});
assert.deepEqual(augustEstimatedSettlement.collected,{TZS:0});
assert.equal(augustEstimatedSettlement.reconciliationIssues,1);

console.log('financial-dashboard-v16 reconciliation + estimated-date receivables + October payment-date + manual-expense-only regression: PASS');