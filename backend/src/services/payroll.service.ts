import prisma from '../lib/prisma';

export async function finalizePayPeriodAndStartPayroll(performedBy: string) {
  const now = new Date();

  // Find open pay periods whose end_date has passed
  const openPeriods = await prisma.payPeriod.findMany({
    where: {
      status: 'open',
      end_date: { lt: now },
    },
  });

  const results = [];

  for (const period of openPeriods) {
    // Aggregate time entries for this pay period
    const entries = await prisma.timeEntry.findMany({
      where: { pay_period_id: period.id, status: { in: ['approved', 'submitted'] } },
    });

    const workerEmails = new Set(entries.map((e) => e.worker_email));
    const totalRegular = entries.reduce((sum, e) => sum + (e.regular_hours || 0), 0);
    const totalOvertime = entries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);

    // Lock the pay period
    const lockedPeriod = await prisma.payPeriod.update({
      where: { id: period.id },
      data: {
        status: 'locked',
        locked_at: now,
        locked_by: performedBy,
        total_regular_hours: totalRegular,
        total_overtime_hours: totalOvertime,
        worker_count: workerEmails.size,
      },
    });

    // Create a payroll run in draft status
    const payrollRun = await prisma.payrollRun.create({
      data: {
        pay_period_id: period.id,
        pay_period_label: `${period.start_date.toISOString().split('T')[0]} - ${period.end_date.toISOString().split('T')[0]}`,
        status: 'draft',
        total_regular_hours: totalRegular,
        total_overtime_hours: totalOvertime,
        worker_count: workerEmails.size,
      },
    });

    results.push({ payPeriod: lockedPeriod, payrollRun });
  }

  return results;
}

export async function submitPayrollRun(payrollRunId: string, submittedBy: string) {
  return prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      status: 'submitted',
      submitted_at: new Date(),
      submitted_by: submittedBy,
    },
  });
}

export async function completePayrollRun(payrollRunId: string, workerResults: string) {
  const run = await prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      status: 'completed',
      worker_results: workerResults,
    },
  });

  // Mark pay period as paid
  await prisma.payPeriod.update({
    where: { id: run.pay_period_id },
    data: { status: 'paid' },
  });

  return run;
}
