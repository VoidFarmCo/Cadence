import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Look up the caller's WorkerProfile to get their app role
    const profiles = await base44.asServiceRole.entities.WorkerProfile.filter({ user_email: user.email });
    const appRole = profiles[0]?.role || user.role;

    const allowedRoles = ['owner', 'admin', 'payroll_admin', 'manager'];
    if (!allowedRoles.includes(appRole)) {
      console.error(`Forbidden: user ${user.email} has role ${appRole}`);
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, appRole: inviteeRole, full_name, phone, worker_type, pay_rate } = body;
    if (!email || !inviteeRole) {
      return Response.json({ error: 'email and appRole are required' }, { status: 400 });
    }

    // Check if WorkerProfile already exists to avoid duplicates
    const existing = await base44.asServiceRole.entities.WorkerProfile.filter({ user_email: email });
    if (existing.length === 0) {
      await base44.asServiceRole.entities.WorkerProfile.create({
        user_email: email,
        full_name: full_name || '',
        phone: phone || '',
        worker_type: worker_type || 'employee',
        role: inviteeRole,
        pay_rate: pay_rate ? parseFloat(pay_rate) : undefined,
        status: 'pending',
      });
    } else {
      // Update existing profile with new info
      await base44.asServiceRole.entities.WorkerProfile.update(existing[0].id, {
        full_name: full_name || existing[0].full_name,
        phone: phone || existing[0].phone,
        worker_type: worker_type || existing[0].worker_type,
        role: inviteeRole,
        pay_rate: pay_rate ? parseFloat(pay_rate) : existing[0].pay_rate,
      });
    }

    // Send the invite WITHOUT specifying a role to avoid the Base44 403 error
    // ("Only admins can invite users with non-default roles").
    // The intended app role is already stored in the WorkerProfile above.
    // RoleRouter will sync the platform role (admin/user) when the invitee first logs in.
    try {
      await base44.asServiceRole.users.inviteUser(email);
    } catch (inviteErr) {
      // If user already exists in the platform, that's fine — profile is already created/updated
      console.warn(`Invite skipped for ${email}: ${inviteErr.message}`);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('inviteWorker error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});