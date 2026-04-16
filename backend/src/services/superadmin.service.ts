import prisma from '../lib/prisma';
import { env } from '../config/env';

/**
 * On server startup, if SUPERADMIN_EMAIL is set and a user with that email
 * exists, promote them to platform_role = 'superadmin'.
 */
export async function promoteSuperAdmin(): Promise<void> {
  const emails = env.SUPERADMIN_EMAIL
    ? env.SUPERADMIN_EMAIL.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    : [];

  if (emails.length === 0) return;

  for (const email of emails) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) continue;

      if (user.platform_role !== 'superadmin') {
        await prisma.user.update({
          where: { id: user.id },
          data: { platform_role: 'superadmin' },
        });
        console.log(`Promoted ${email} to superadmin`);
      }
    } catch (err) {
      console.error(`Failed to promote ${email} to superadmin:`, err);
    }
  }
}
