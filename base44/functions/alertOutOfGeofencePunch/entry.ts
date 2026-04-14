import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const punch = payload.data;

    // Only alert if punch is out of geofence
    if (!punch.out_of_geofence) {
      return Response.json({ success: true, alerted: false });
    }

    // Get all admin users
    const admins = await base44.asServiceRole.entities.User.filter({
      role: 'admin'
    });

    if (admins.length === 0) {
      return Response.json({ success: true, alerted: false, error: 'No admins found' });
    }

    const alertResults = [];

    for (const admin of admins) {
      try {
        const punchTypeLabel = punch.punch_type.replace('_', ' ').toUpperCase();
        const reasonText = punch.out_of_geofence_reason 
          ? ` (Reason: ${punch.out_of_geofence_reason.replace('_', ' ')})` 
          : '';

        await base44.integrations.Core.SendEmail({
          to: admin.email,
          subject: `⚠️ Out-of-Geofence Punch Alert`,
          body: `A punch has been recorded outside the designated site boundary.\n\nWorker: ${punch.worker_name}\nEmail: ${punch.worker_email}\nPunch Type: ${punchTypeLabel}\nTime: ${punch.timestamp}\nSite: ${punch.site_name}${reasonText}\n\nPlease review this entry in the Time Approval section.\n\nBest regards,\nCadence System`
        });

        alertResults.push({
          admin_email: admin.email,
          alerted: true
        });
      } catch (error) {
        console.error(`Error alerting admin ${admin.email}:`, error);
        alertResults.push({
          admin_email: admin.email,
          alerted: false,
          error: error.message
        });
      }
    }

    const alertedCount = alertResults.filter(r => r.alerted).length;

    return Response.json({
      success: true,
      alerted: true,
      punch_id: punch.id,
      worker: punch.worker_name,
      admins_alerted: alertedCount,
      results: alertResults
    });
  } catch (error) {
    console.error('Out of geofence alert error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});