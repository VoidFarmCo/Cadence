import prisma from './prisma';

/**
 * Get the company_id for the given user email.
 * Auto-repairs existing accounts that pre-date the company_id column by
 * matching them to the Company created at the same time as their Account.
 */
export async function getCompanyId(userEmail: string): Promise<string | null> {
  const profile = await prisma.workerProfile.findFirst({
    where: { user_email: userEmail },
    select: { company_id: true },
  });

  if (profile?.company_id) return profile.company_id;

  // Auto-repair: profiles created before company_id was added have null.
  // For owners: find the Company created within 60s of their Account.
  const account = await prisma.account.findFirst({
    where: { owner_email: userEmail },
    select: { created_at: true },
  });

  if (account) {
    const window = 60 * 1000;
    const company = await prisma.company.findFirst({
      where: {
        created_at: {
          gte: new Date(account.created_at.getTime() - window),
          lte: new Date(account.created_at.getTime() + window),
        },
      },
    });

    if (company) {
      // Stamp company_id on all this user's null profiles and their invited workers
      await prisma.workerProfile.updateMany({
        where: { user_email: userEmail, company_id: null },
        data: { company_id: company.id },
      });
      return company.id;
    }
  }

  return null;
}

/**
 * Get all worker emails that belong to the same company as the given user.
 * Used to filter worker-keyed records (punches, time entries, etc.)
 */
export async function getCompanyWorkerEmails(userEmail: string): Promise<string[]> {
  const companyId = await getCompanyId(userEmail);
  if (!companyId) return [userEmail]; // fallback: only own data

  const profiles = await prisma.workerProfile.findMany({
    where: { company_id: companyId },
    select: { user_email: true },
  });
  return profiles.map((p: { user_email: string }) => p.user_email);
}
