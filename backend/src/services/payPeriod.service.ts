import prisma from '../lib/prisma';

type PeriodType = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

/**
 * Compute the end date of a single period starting at `start`.
 */
function computePeriodEnd(start: Date, type: PeriodType): Date {
  const end = new Date(start);
  switch (type) {
    case 'weekly':
      end.setDate(end.getDate() + 6);
      break;
    case 'biweekly':
      end.setDate(end.getDate() + 13);
      break;
    case 'semimonthly':
      // 1st–15th or 16th–end of month
      if (start.getDate() <= 15) {
        end.setDate(15);
      } else {
        end.setMonth(end.getMonth() + 1, 0); // last day of current month
      }
      break;
    case 'monthly': {
      // End = day before same calendar day next month (clamped for short months)
      const y = start.getFullYear();
      const m = start.getMonth() + 1;
      const d = start.getDate();
      // Day 0 of month m+1 = last day of month m
      const lastDay = new Date(y, m + 1, 0).getDate();
      const endDay = Math.min(d, lastDay);
      end.setFullYear(y, m, endDay - 1);
      if (endDay - 1 <= 0) {
        // anchor day 1: end is last day of current anchor month
        end.setFullYear(y, m, 0);
      }
      break;
    }
    default:
      end.setDate(end.getDate() + 13); // fallback biweekly
  }
  return end;
}

/**
 * Compute the next period start date after a given period ends.
 */
function nextPeriodStart(end: Date, type: PeriodType): Date {
  const next = new Date(end);
  next.setDate(next.getDate() + 1);

  // For semimonthly, align to 1st or 16th
  if (type === 'semimonthly') {
    if (next.getDate() <= 15) {
      next.setDate(1);
    } else {
      next.setDate(16);
    }
  }
  return next;
}

/**
 * Find the period start that contains or is nearest-future to today,
 * based on the anchor date and period type.
 */
function findCurrentPeriodStart(anchor: Date, type: PeriodType, today: Date): Date {
  let candidate = new Date(anchor);
  // Strip time components for date-only comparison
  candidate.setHours(0, 0, 0, 0);
  const todayClean = new Date(today);
  todayClean.setHours(0, 0, 0, 0);

  if (type === 'semimonthly') {
    // Align to 1st or 16th of the month containing today
    candidate = new Date(todayClean);
    if (todayClean.getDate() <= 15) {
      candidate.setDate(1);
    } else {
      candidate.setDate(16);
    }
    return candidate;
  }

  // For weekly/biweekly/monthly, step forward from anchor
  const periodDays = type === 'weekly' ? 7 : type === 'biweekly' ? 14 : 30;

  // If anchor is in the future, step backward
  if (candidate > todayClean) {
    while (candidate > todayClean) {
      candidate.setDate(candidate.getDate() - periodDays);
    }
  } else {
    // Step forward until we pass today, then step back one
    while (candidate <= todayClean) {
      const next = new Date(candidate);
      next.setDate(next.getDate() + periodDays);
      if (next > todayClean) break;
      candidate = next;
    }
  }

  // For monthly, re-align using month arithmetic
  if (type === 'monthly') {
    const anchorDay = anchor.getDate();
    candidate = new Date(todayClean.getFullYear(), todayClean.getMonth(), anchorDay);
    if (candidate > todayClean) {
      candidate.setMonth(candidate.getMonth() - 1);
    }
  }

  return candidate;
}

/**
 * Generate `count` pay periods for a company, skipping any that overlap
 * with existing periods.
 */
export async function generatePayPeriodsForCompany(
  companyId: string,
  periodType: PeriodType,
  anchorDate: Date,
  count: number
) {
  const today = new Date();
  let start = findCurrentPeriodStart(anchorDate, periodType, today);

  // Fetch existing periods to avoid duplicates
  const existing = await prisma.payPeriod.findMany({
    where: { company_id: companyId },
    select: { start_date: true, end_date: true },
  });

  const existingRanges = existing.map((p) => ({
    start: p.start_date.getTime(),
    end: p.end_date.getTime(),
  }));

  function overlaps(s: Date, e: Date) {
    const st = s.getTime();
    const et = e.getTime();
    return existingRanges.some((r) => st <= r.end && et >= r.start);
  }

  const created = [];
  let generated = 0;
  let attempts = 0;

  while (generated < count && attempts < count * 2) {
    const end = computePeriodEnd(start, periodType);

    if (!overlaps(start, end)) {
      const period = await prisma.payPeriod.create({
        data: {
          company_id: companyId,
          start_date: start,
          end_date: end,
          status: 'open',
        },
      });
      created.push(period);
      generated++;
    }

    start = nextPeriodStart(end, periodType);
    attempts++;
  }

  return created;
}

/**
 * Find the pay period that contains a given date for a company.
 */
export async function findPayPeriodForDate(
  companyId: string,
  date: Date
): Promise<string | null> {
  const period = await prisma.payPeriod.findFirst({
    where: {
      company_id: companyId,
      start_date: { lte: date },
      end_date: { gte: date },
    },
    select: { id: true },
  });
  return period?.id || null;
}
