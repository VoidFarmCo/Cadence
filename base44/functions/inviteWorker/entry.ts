import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
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

    const { email, appRole: inviteeRole } = await req.json();
    if (!email || !inviteeRole) {
      return Response.json({ error: 'email and appRole are required' }, { status: 400 });
    }

    // Employer-side roles need platform 'admin' so they can access employer features. Workers get 'user'.
    const platformRole = ['owner', 'manager', 'payroll_admin'].includes(inviteeRole) ? 'admin' : 'user';

    await base44.asServiceRole.users.inviteUser(email, platformRole);

    return Response.json({ success: true });
  } catch (error) {
    console.error('inviteWorker error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});