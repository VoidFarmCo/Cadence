import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedRoles = ['owner', 'admin', 'payroll_admin'];
    if (!allowedRoles.includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, appRole } = await req.json();
    if (!email || !appRole) {
      return Response.json({ error: 'email and appRole are required' }, { status: 400 });
    }

    // Employer-side roles (owner, manager, payroll_admin) need platform 'admin' role
    // so they can access employer features. Workers get 'user'.
    const platformRole = ['owner', 'manager', 'payroll_admin'].includes(appRole) ? 'admin' : 'user';

    await base44.asServiceRole.users.inviteUser(email, platformRole);

    return Response.json({ success: true });
  } catch (error) {
    console.error('inviteWorker error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});