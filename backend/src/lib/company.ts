import prisma from './prisma';

/**
 * Get the company_id for the given user email.
 * Returns null if no profile or company found.
 */
export async function getCompanyId(userEmail: string): Promise<string | null> {
  const profile = await prisma.workerProfile.findFirst({
    where: { user_email: userEmail },
    select: { company_id: true },
  });
  return profile?.company_id ?? null;
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
  return profiles.map(p => p.user_email);
}
