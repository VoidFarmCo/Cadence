import prisma from './prisma';

/**
 * Get the company_id for the given user email.
 * Looks up the WorkerProfile first; falls back to auto-repair for legacy data.
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
    select: { created_at: true, company_id: true },
  });

  if (account?.company_id) {
    // Account already linked — stamp it on the profile
    await prisma.workerProfile.updateMany({
      where: { user_email: userEmail, company_id: null },
      data: { company_id: account.company_id },
    });
    return account.company_id;
  }

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
      // Stamp company_id on the profile and link the account
      await prisma.workerProfile.updateMany({
        where: { user_email: userEmail, company_id: null },
        data: { company_id: company.id },
      });
      await prisma.account.updateMany({
        where: { owner_email: userEmail, company_id: null },
        data: { company_id: company.id },
      });
      return company.id;
    }
  }

  return null;
}

/**
 * Get all worker emails that belong to the same company as the given user.
 * Used as a fallback for routes that still need email-based filtering.
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

/**
 * Parse pagination query params. Returns skip, take, page, limit.
 */
export function parsePagination(query: { page?: string; limit?: string }): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit || '50', 10) || 50));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

/**
 * Build a paginated response envelope.
 */
export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}
