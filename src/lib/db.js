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
// Auth + company helpers
// ---------------------------------------------------------------------------

// Companies the signed-in user is a member of, with their per-company role.
// Used at app boot and for the company switcher in AppContext.
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

// Server-side RPC: creates a company, makes caller owner, bootstraps a 14-day
// trial account, in a single transaction.
export async function createCompany(name, state = 'NM') {
  const { data, error } = await supabase.rpc('create_company', { p_name: name, p_state: state });
  if (error) throw error;
  return data;   // new company id (uuid)
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

// Returns the calling user's worker_profile in the given company, or null if
// they aren't a worker in that company. Used by punch/time-entry pages to
// pre-fill worker_profile_id without scanning the full worker_profiles list.
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
