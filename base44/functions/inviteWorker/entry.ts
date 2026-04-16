import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    // Read body first before SDK consumes the request
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
    }

    // Employer-side roles need platform 'admin' so they can access employer features. Workers get 'user'.
    const platformRole = ['owner', 'manager', 'payroll_admin'].includes(inviteeRole) ? 'admin' : 'user';

    await base44.auth.inviteUser(email, platformRole);

    return Response.json({ success: true });
  } catch (error) {
    console.error('inviteWorker error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});