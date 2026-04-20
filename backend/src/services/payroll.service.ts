import prisma from '../lib/prisma';

export async function finalizePayPeriodAndStartPayroll(performedBy: string, companyId: string | null) {
  if (!companyId) return [];

  const now = new Date();

  // Find open pay periods whose end_date has passed, scoped to this company
  const openPeriods = await prisma.payPeriod.findMany({
    where: {
      status: 'open',
      end_date: { lt: now },
      company_id: companyId,
    },
  });

  const results = [];

  for (const period of openPeriods) {
    // Only count approved entries for payroll
    const entries = await prisma.timeEntry.findMany({
      where: { pay_period_id: period.id, status: 'approved' },
    });

    const workerEmails = new Set(entries.map((e) => e.worker_email));
    const totalRegular = entries.reduce((sum, e) => sum + (e.regular_hours || 0), 0);
    const totalOvertime = entries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);

    // Check for existing draft run to prevent duplicates
    const existingRun = await prisma.payrollRun.findFirst({
      where: { pay_period_id: period.id },
    });
    if (existingRun) continue;

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
        company_id: companyId,
      },
    });

    results.push({ payPeriod: lockedPeriod, payrollRun });
  }

  return results;
}

export async function submitPayrollRun(payrollRunId: string, submittedBy: string) {
  const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
  if (!run) throw new Error('Payroll run not found');
  if (run.status !== 'draft' && run.status !== 'reviewing') {
    throw new Error(`Cannot submit a payroll run in '${run.status}' status`);
  }

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
  const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
  if (!run) throw new Error('Payroll run not found');
  if (run.status !== 'submitted') {
    throw new Error(`Cannot complete a payroll run in '${run.status}' status`);
  }

  const updated = await prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      status: 'completed',
      worker_results: workerResults,
    },
  });

  // Mark pay period as paid
  await prisma.payPeriod.update({
    where: { id: updated.pay_period_id },
    data: { status: 'paid' },
  });

  return updated;
}
