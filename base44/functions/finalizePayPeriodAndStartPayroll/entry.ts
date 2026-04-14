import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all open pay periods
    const openPeriods = await base44.asServiceRole.entities.PayPeriod.filter({
      status: 'open'
    });

    if (openPeriods.length === 0) {
      return Response.json({
        success: true,
        message: 'No open pay periods found'
      });
    }

    const results = [];

    for (const period of openPeriods) {
      try {
        const periodEndDate = new Date(period.end_date);
        const today = new Date();

        // Only finalize periods that have ended
        if (today >= periodEndDate) {
          // Get time entries for this period to calculate totals
          const timeEntries = await base44.asServiceRole.entities.TimeEntry.filter({
            pay_period_id: period.id,
            status: { $in: ['submitted', 'approved'] }
          });

          // Calculate totals
          let totalRegularHours = 0;
          let totalOvertimeHours = 0;
          const workerSet = new Set();

          for (const entry of timeEntries) {
            totalRegularHours += entry.regular_hours || 0;
            totalOvertimeHours += entry.overtime_hours || 0;
            if (entry.worker_email) {
              workerSet.add(entry.worker_email);
            }
          }

          // Finalize the pay period
          await base44.asServiceRole.entities.PayPeriod.update(period.id, {
            status: 'locked',
            locked_at: new Date().toISOString(),
            total_regular_hours: totalRegularHours,
            total_overtime_hours: totalOvertimeHours,
            worker_count: workerSet.size
          });

          // Create new payroll run
          const newRun = await base44.asServiceRole.entities.PayrollRun.create({
            pay_period_id: period.id,
            pay_period_label: `${period.start_date} to ${period.end_date}`,
            status: 'draft',
            total_regular_hours: totalRegularHours,
            total_overtime_hours: totalOvertimeHours,
            worker_count: workerSet.size
          });

          results.push({
            pay_period_id: period.id,
            period_range: `${period.start_date} to ${period.end_date}`,
            finalized: true,
            payroll_run_id: newRun.id,
            total_regular_hours: totalRegularHours,
            total_overtime_hours: totalOvertimeHours,
            worker_count: workerSet.size
          });
        } else {
          results.push({
            pay_period_id: period.id,
            period_range: `${period.start_date} to ${period.end_date}`,
            finalized: false,
            reason: 'Period has not ended yet'
          });
        }
      } catch (error) {
        console.error(`Error processing pay period ${period.id}:`, error);
        results.push({
          pay_period_id: period.id,
          finalized: false,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      periods_processed: results.length,
      results
    });
  } catch (error) {
    console.error('Finalize pay period error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});