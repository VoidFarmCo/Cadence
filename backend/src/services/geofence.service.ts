import prisma from '../lib/prisma';
import { sendEmail } from './email.service';

export async function checkGeofenceAndAlert(punchId: string): Promise<void> {
  const punch = await prisma.punch.findUnique({ where: { id: punchId } });
  if (!punch || !punch.out_of_geofence) return;

  // Find the worker's company to scope the notification
  const workerProfile = await prisma.workerProfile.findFirst({
    where: { user_email: punch.worker_email },
    select: { company_id: true },
  });

  if (!workerProfile?.company_id) return;

  // Only notify admins from the same company
  const companyProfiles = await prisma.workerProfile.findMany({
    where: {
      company_id: workerProfile.company_id,
      role: { in: ['owner', 'payroll_admin', 'manager'] },
    },
    select: { user_email: true },
  });

  const adminEmails = companyProfiles.map((p) => p.user_email);
  if (adminEmails.length === 0) return;

  const subject = `Geofence Alert: ${punch.worker_name} punched outside geofence`;
  const body = `
    <h2>Out-of-Geofence Punch Alert</h2>
    <p><strong>Worker:</strong> ${escapeHtml(punch.worker_name || '')} (${escapeHtml(punch.worker_email)})</p>
    <p><strong>Punch Type:</strong> ${escapeHtml(punch.punch_type)}</p>
    <p><strong>Time:</strong> ${punch.timestamp.toISOString()}</p>
    <p><strong>Site:</strong> ${escapeHtml(punch.site_name || 'N/A')}</p>
    <p><strong>Reason:</strong> ${escapeHtml(punch.out_of_geofence_reason || 'Unknown')}</p>
    ${punch.latitude && punch.longitude ? `<p><strong>Location:</strong> ${punch.latitude}, ${punch.longitude}</p>` : ''}
    ${punch.note ? `<p><strong>Note:</strong> ${escapeHtml(punch.note)}</p>` : ''}
  `;

  try {
    // Send individually to avoid exposing email addresses
    for (const email of adminEmails) {
      await sendEmail(email, subject, body);
    }
  } catch (err) {
    console.error('Failed to send geofence alert:', err);
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
