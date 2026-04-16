import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has a WorkerProfile (using service role to bypass RLS)
    const profiles = await base44.asServiceRole.entities.WorkerProfile.filter({ user_email: user.email });
    
    if (profiles.length > 0) {
      // User already has a profile - return it
      const profile = profiles[0];
      
      // Sync platform role with profile role if needed
      const platformRole = ['owner', 'manager', 'payroll_admin'].includes(profile.role) ? 'admin' : 'user';
      if (user.role !== platformRole) {
        await base44.auth.updateMe({ role: platformRole });
      }
      
      return Response.json({ 
        success: true, 
        isNew: false, 
        profile,
        role: profile.role 
      });
    }

    // Brand new user - create owner profile and account
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 30);

    // Create WorkerProfile with service role
    const newProfile = await base44.asServiceRole.entities.WorkerProfile.create({
      user_email: user.email,
      full_name: user.full_name || '',
      worker_type: 'employee',
      role: 'owner',
      status: 'active',
    });

    // Create Account with service role
    await base44.asServiceRole.entities.Account.create({
      owner_email: user.email,
      owner_name: user.full_name || '',
      status: 'trial',
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
    });

    // Update platform role to admin so they can access admin features
    await base44.auth.updateMe({ role: 'admin' });

    return Response.json({ 
      success: true, 
      isNew: true, 
      profile: newProfile,
      role: 'owner',
      trialEnd: trialEnd.toISOString()
    });
  } catch (error) {
    console.error('onboardNewOwner error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});