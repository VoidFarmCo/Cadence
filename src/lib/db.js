// Supabase-backed data-access layer for Cadence.
//
// Each entity exposes the same { list, get, create, update, delete } shape as
// the old axios-based src/api/entities.js so call sites can swap their import
// from `@/api/entities` to `@/lib/db` with no other changes:
//
//   - import { Punches } from '@/api/entities';   // OLD: hits Express+Prisma backend
//   + import { Punches } from '@/lib/db';         // NEW: hits Supabase directly
//
// The two imports can coexist during the migration; pages can be ported one
// at a time.

import { supabase } from './supabase';

// Build a CRUD entity backed by a Supabase table. `list({ key: value, ... })`
// applies equality filters; `orderBy: { column, ascending }` overrides the
// default sort; `limit` / `offset` paginate.
function createEntity(table, options = {}) {
  const defaultOrder = options.defaultOrder || { column: 'created_at', ascending: false };
  return {
    async list(params = {}) {
      let q = supabase.from(table).select('*');
      for (const [key, val] of Object.entries(params)) {
        if (val === undefined || val === null) continue;
        if (key === 'orderBy' || key === 'limit' || key === 'offset') continue;
        q = q.eq(key, val);
      }
      const order = params.orderBy || defaultOrder;
      if (order) q = q.order(order.column, { ascending: !!order.ascending });
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

// ---------------------------------------------------------------------------
// Foundation entities (from migration 0001 + 0004)
// ---------------------------------------------------------------------------
export const Profiles       = createEntity('profiles',        { defaultOrder: { column: 'created_at', ascending: true } });
export const Companies      = createEntity('companies');
export const CompanyMembers = createEntity('company_members', { defaultOrder: { column: 'joined_at',  ascending: true } });
export const Accounts       = createEntity('accounts');
export const Sites          = createEntity('sites',           { defaultOrder: { column: 'name',       ascending: true } });
export const WorkerProfiles = createEntity('worker_profiles', { defaultOrder: { column: 'full_name',  ascending: true } });

// ---------------------------------------------------------------------------
// Workforce-core entities (from migration 0007)
// ---------------------------------------------------------------------------
export const Punches     = createEntity('punches',      { defaultOrder: { column: 'timestamp',  ascending: false } });
export const TimeEntries = createEntity('time_entries', { defaultOrder: { column: 'date',       ascending: false } });
export const Shifts      = createEntity('shifts',       { defaultOrder: { column: 'date',       ascending: false } });
export const PayPeriods  = createEntity('pay_periods',  { defaultOrder: { column: 'start_date', ascending: false } });
export const PayrollRuns = createEntity('payroll_runs');

// Stubs to fill in as later migrations land:
// Expenses, LeaveRequests, TaxDeductions, TaxForms, Messages,
// WorkerDocuments, AuditLogs.

// ---------------------------------------------------------------------------
// Auth-aware helpers (richer than the entity CRUD surface)
// ---------------------------------------------------------------------------

// Companies the signed-in user is a member of, with their per-company role.
export async function listMyCompanies() {
  const { data: { user } } = await supabase.auth.getUser();
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

// Calls the create_company RPC: makes a company, the caller becomes owner,
// a 14-day trial account is bootstrapped. Returns the new company id.
export async function createCompany(name, state = 'NM') {
  const { data, error } = await supabase.rpc('create_company', { p_name: name, p_state: state });
  if (error) throw error;
  return data;
}

// Lets a non-owner remove themselves from a company.
export async function leaveCompany(companyId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');
  const { error } = await supabase
    .from('company_members')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', user.id);
  if (error) throw error;
}

// The signed-in user's worker_profile in `companyId`, or null if they don't
// have one (e.g. they're an admin who isn't tracked as a worker). Pages that
// create punches use this to fill in worker_profile_id and worker_name.
export async function getMyWorkerProfile(companyId) {
  if (!companyId) return null;
  const { data: { user } } = await supabase.auth.getUser();
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
