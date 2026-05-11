// Cadence data-access layer over Supabase.
//
// Each entity exposes the same { list, get, create, update, delete } shape as
// the existing axios-based src/api/entities.js, so call sites can switch over
// by changing one import:
//
//   - import { Punches } from '@/api/entities';
//   + import { Punches } from '@/lib/db';
//
// Foundation tables come from migrations 0001 + 0004; workforce-core tables
// come from 0007. Other entities (expenses, leave_requests, tax_*, messages,
// worker_documents, audit_logs) will be added as their migrations land.
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Generic entity factory
// ---------------------------------------------------------------------------
// `params` to list() supports:
//   * Equality filters: any key whose value is not undefined/null becomes a .eq()
//   * orderBy: { column, ascending }  (defaults to options.defaultOrder)
//   * limit:  number of rows
//   * offset: starting row (used with limit)
// Reserved keys (orderBy/limit/offset) are NOT translated to .eq() filters.
const RESERVED_PARAMS = new Set(['orderBy', 'limit', 'offset']);

function createEntity(table, options = {}) {
  const { defaultOrder = { column: 'created_at', ascending: false } } = options;
  return {
    async list(params = {}) {
      let q = supabase.from(table).select('*');
      for (const [key, val] of Object.entries(params)) {
        if (RESERVED_PARAMS.has(key)) continue;
        if (val === undefined || val === null) continue;
        q = q.eq(key, val);
      }
      const order = params.orderBy || defaultOrder;
      if (order && order.column) q = q.order(order.column, { ascending: !!order.ascending });
      if (params.limit) {
        const offset = params.offset || 0;
        q = q.range(offset, offset + params.limit - 1);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async create(input) {
      const { data, error } = await supabase.from(table).insert(input).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, patch) {
      const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return { id };
    },
  };
}

// Resolve the current Supabase user, surfacing any auth error rather than
// silently producing undefined and proceeding. Returns null only when the
// caller is genuinely signed out (data.user is null without an error).
//
// Callers decide what to do with null — listMyCompanies returns [], the
// require-auth helpers throw 'not authenticated', etc.
async function getCurrentUserOrThrow() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user || null;
}

// Canonical form of an invite-link token. Currently just trim, but having
// a single helper means future changes (case folding, allow-list of chars,
// etc.) only touch one place.
function normalizeInviteToken(token) {
  return (token || '').trim();
}

// ---------------------------------------------------------------------------
// Foundation entities (migrations 0001 + 0004)
// ---------------------------------------------------------------------------
export const Profiles       = createEntity('profiles',        { defaultOrder: { column: 'created_at', ascending: true } });
export const Companies      = createEntity('companies',       { defaultOrder: { column: 'name',       ascending: true } });
export const CompanyMembers = createEntity('company_members', { defaultOrder: { column: 'joined_at',  ascending: true } });
export const Accounts       = createEntity('accounts');
export const Sites          = createEntity('sites',           { defaultOrder: { column: 'name',       ascending: true } });
export const WorkerProfiles = createEntity('worker_profiles', { defaultOrder: { column: 'full_name',  ascending: true } });

// ---------------------------------------------------------------------------
// Workforce-core entities (migration 0007)
// ---------------------------------------------------------------------------
export const Punches      = createEntity('punches',      { defaultOrder: { column: 'timestamp',  ascending: false } });
export const TimeEntries  = createEntity('time_entries', { defaultOrder: { column: 'date',       ascending: false } });
export const Shifts       = createEntity('shifts',       { defaultOrder: { column: 'date',       ascending: false } });
export const PayPeriods   = createEntity('pay_periods',  { defaultOrder: { column: 'start_date', ascending: false } });
export const PayrollRuns  = createEntity('payroll_runs');

// ---------------------------------------------------------------------------
// Onboarding entities (migrations 0018 + 0019)
// ---------------------------------------------------------------------------
export const Invitations = createEntity('invitations',  { defaultOrder: { column: 'created_at', ascending: false } });
export const InviteLinks = createEntity('invite_links', { defaultOrder: { column: 'created_at', ascending: false } });

// ---------------------------------------------------------------------------
// Auth + company helpers
// ---------------------------------------------------------------------------

// Companies the signed-in user is a member of, with their per-company role.
// Used at app boot and for the company switcher in AppContext.
export async function listMyCompanies() {
  const user = await getCurrentUserOrThrow();
  if (!user) return [];

  const { data, error } = await supabase
    .from('company_members')
    .select('role, status, joined_at, companies!inner(id, name, state, created_at)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });
  if (error) throw error;

  return (data || []).map(row => ({
    id: row.companies.id,
    name: row.companies.name,
    state: row.companies.state,
    createdAt: row.companies.created_at,
    role: row.role,
    membershipStatus: row.status,
    joinedAt: row.joined_at,
  }));
}

// Server-side RPC: creates a company, makes caller owner, bootstraps a 14-day
// trial account, in a single transaction.
export async function createCompany(name, state = 'NM') {
  const { data, error } = await supabase.rpc('create_company', { p_name: name, p_state: state });
  if (error) throw error;
  return data;   // new company id (uuid)
}

// Lets a non-owner remove themselves from a company.
export async function leaveCompany(companyId) {
  const user = await getCurrentUserOrThrow();
  if (!user) throw new Error('not authenticated');
  const { error } = await supabase
    .from('company_members')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', user.id);
  if (error) throw error;
}

// Returns the calling user's worker_profile in the given company, or null if
// they aren't a worker in that company. Used by punch/time-entry pages to
// pre-fill worker_profile_id without scanning the full worker_profiles list.
export async function getMyWorkerProfile(companyId) {
  if (!companyId) return null;
  const user = await getCurrentUserOrThrow();
  if (!user) return null;
  const { data, error } = await supabase
    .from('worker_profiles')
    .select('*')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Invitations (migration 0018)
// ---------------------------------------------------------------------------
// Admin-driven email invitations: owner/payroll_admin creates one, the
// invited user gets added to company_members when they sign up.
//
// invitations.email is normalized to lower(btrim(...)) by a BEFORE trigger
// (migration 0020) so callers don't strictly have to lowercase, but doing
// it here too keeps the round-trip predictable.

export async function listInvitations(companyId) {
  if (!companyId) throw new Error('listInvitations: companyId required');
  return Invitations.list({ company_id: companyId });
}

export async function createInvitation({ email, role }, companyId) {
  if (!companyId) throw new Error('createInvitation: companyId required');
  if (!email)     throw new Error('createInvitation: email required');
  const user = await getCurrentUserOrThrow();
  if (!user) throw new Error('createInvitation: not authenticated');
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      company_id: companyId,
      email: email.trim().toLowerCase(),
      role: role || 'worker',
      invited_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Mark an invitation as revoked. The invitation stays in the table for
// audit purposes (status flips to 'revoked' rather than deleting the row).
export async function revokeInvitation(id) {
  const { data, error } = await supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Retroactively apply pending invitations for an email that already has an
// account (useful when an admin invites someone who's already signed up).
// Returns the count of invitations actually applied.
export async function applyInvitationFor(email) {
  if (!email) return 0;
  const { data, error } = await supabase.rpc('apply_invitation_for', {
    target_email: email.trim().toLowerCase(),
  });
  if (error) throw error;
  return data ?? 0;
}

// ---------------------------------------------------------------------------
// Invite links (migration 0019)
// ---------------------------------------------------------------------------
// Shareable token-based join URLs. Admin generates one, anyone with the URL
// can sign in and redeem to join the company.

export async function listInviteLinks(companyId) {
  if (!companyId) throw new Error('listInviteLinks: companyId required');
  return InviteLinks.list({ company_id: companyId });
}

// Server-side RPC so token generation stays in Postgres. The DB rejects
// maxUses <= 0 with a clear error (added in 0021).
export async function createInviteLink({ companyId, role, maxUses, expiresAt }) {
  if (!companyId) throw new Error('createInviteLink: companyId required');
  const { data, error } = await supabase.rpc('create_invite_link', {
    p_company_id: companyId,
    p_role:       role || 'worker',
    p_max_uses:   maxUses ?? null,
    p_expires_at: expiresAt ?? null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function revokeInviteLink(id) {
  const { data, error } = await supabase
    .from('invite_links')
    .update({ revoked: true })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// peek: callable by anon (no auth required). Returns the company name +
// an is_usable boolean so the join page can show "Joining Acme Corp" before
// sign-in, plus a clear "this invite is no longer valid" message for
// revoked/expired/used-up links.
export async function peekInviteLink(token) {
  const t = normalizeInviteToken(token);
  if (!t) return null;
  const { data, error } = await supabase.rpc('peek_invite_link', { p_token: t });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

// redeem: authenticated only. Adds the caller to the link's company. Returns
// the company id. The function uses SELECT ... FOR UPDATE so concurrent
// redemptions can't overshoot max_uses (added in 0020).
export async function redeemInviteLink(token) {
  const t = normalizeInviteToken(token);
  if (!t) throw new Error('redeemInviteLink: token required');
  const { data, error } = await supabase.rpc('redeem_invite_link', { p_token: t });
  if (error) throw error;
  return data; // company id (uuid)
}
