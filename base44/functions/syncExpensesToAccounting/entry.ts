import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication and admin role (required for entity automations)
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const payload = await req.json();
    const payroll_run_id = payload.payroll_run_id || payload.event?.entity_id;

    if (!payroll_run_id) {
      return Response.json({ error: 'payroll_run_id required' }, { status: 400 });
    }

    // Get the payroll run
    const payrollRun = await base44.asServiceRole.entities.PayrollRun.filter({
      id: payroll_run_id
    });

    if (!payrollRun || payrollRun.length === 0) {
      return Response.json({ error: 'PayrollRun not found' }, { status: 404 });
    }

    const run = payrollRun[0];

    // Get the pay period
    const payPeriod = await base44.asServiceRole.entities.PayPeriod.filter({
      id: run.pay_period_id
    });

    if (!payPeriod || payPeriod.length === 0) {
      return Response.json({ error: 'PayPeriod not found' }, { status: 404 });
    }

    const period = payPeriod[0];

    // Get all approved expenses for this pay period
    const expenses = await base44.asServiceRole.entities.Expense.filter({
      status: 'approved',
      date: {
        $gte: period.start_date,
        $lte: period.end_date
      }
    });

    // Get company info to check QB connection
    const companies = await base44.asServiceRole.entities.Company.list();
    const company = companies[0];

    if (!company || !company.qb_connected) {
      return Response.json({
        success: false,
        error: 'QuickBooks not connected',
        expenses_count: expenses.length
      });
    }

    // Get QB access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('quickbooks');

    const syncResults = [];

    for (const expense of expenses) {
      try {
        // Map expense categories to QB account codes
        const categoryMap = {
          fuel: '12000',
          supplies: '12001',
          repairs: '12002',
          tools: '12003',
          mileage: '12004',
          other: '12005'
        };

        const accountRef = categoryMap[expense.category] || '12005';

        // Create QB journal entry for the expense
        const qbEntry = {
          docNumber: `EXP-${expense.id}`,
          txnDate: expense.date,
          line: [
            {
              amount: expense.amount,
              detailType: 'JournalEntryLineDetail',
              JournalEntryLineDetail: {
                postingType: 'Debit',
                accountRef: { value: accountRef }
              },
              description: `${expense.category.replace('_', ' ').toUpperCase()} - ${expense.worker_name}`
            },
            {
              amount: -expense.amount,
              detailType: 'JournalEntryLineDetail',
              JournalEntryLineDetail: {
                postingType: 'Credit',
                accountRef: { value: '12100' } // Default liability account
              },
              description: 'Expense clearing account'
            }
          ]
        };

        // Send to QB
        const qbResponse = await fetch('https://quickbooks.api.intuit.com/v2/companyadmin/v4/accounts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(qbEntry)
        });

        if (qbResponse.ok) {
          syncResults.push({
            expense_id: expense.id,
            worker: expense.worker_name,
            amount: expense.amount,
            synced: true
          });
        } else {
          syncResults.push({
            expense_id: expense.id,
            worker: expense.worker_name,
            amount: expense.amount,
            synced: false,
            error: await qbResponse.text()
          });
        }
      } catch (error) {
        console.error(`Error syncing expense ${expense.id}:`, error);
        syncResults.push({
          expense_id: expense.id,
          worker: expense.worker_name,
          amount: expense.amount,
          synced: false,
          error: error.message
        });
      }
    }

    // Update company QB sync timestamp
    await base44.asServiceRole.entities.Company.update(company.id, {
      qb_last_sync: new Date().toISOString()
    });

    const syncedCount = syncResults.filter(r => r.synced).length;

    return Response.json({
      success: true,
      payroll_run_id,
      expenses_total: expenses.length,
      expenses_synced: syncedCount,
      results: syncResults
    });
  } catch (error) {
    console.error('Sync expenses error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});