import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This function is triggered only by automation, verify request authenticity
    const payload = await req.json();
    if (!payload.event?.entity_id || payload.event.type !== 'create') {
      return Response.json({ error: 'Forbidden: Invalid automation payload' }, { status: 403 });
    }
    const punch = payload.data;
    const punchId = payload.event?.entity_id;

    if (!punchId) {
      return Response.json({ error: 'Forbidden: Missing event context' }, { status: 403 });
    }

    const verifiedPunch = await base44.asServiceRole.entities.Punch.get(punchId);
    if (!verifiedPunch) {
      return Response.json({ error: 'Forbidden: Punch record not found' }, { status: 403 });
    }

    // Only alert if punch is out of geofence
    if (!verifiedPunch.out_of_geofence) {
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
        const punchTypeLabel = verifiedPunch.punch_type.replace('_', ' ').toUpperCase();
        const reasonText = verifiedPunch.out_of_geofence_reason 
          ? ` (Reason: ${verifiedPunch.out_of_geofence_reason.replace('_', ' ')})` 
          : '';

        await base44.integrations.Core.SendEmail({
          to: admin.email,
          subject: `⚠️ Out-of-Geofence Punch Alert`,
          body: `A punch has been recorded outside the designated site boundary.\n\nWorker: ${verifiedPunch.worker_name}\nEmail: ${verifiedPunch.worker_email}\nPunch Type: ${punchTypeLabel}\nTime: ${verifiedPunch.timestamp}\nSite: ${verifiedPunch.site_name}${reasonText}\n\nPlease review this entry in the Time Approval section.\n\nBest regards,\nCadence System`
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
      punch_id: verifiedPunch.id,
      worker: verifiedPunch.worker_name,
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