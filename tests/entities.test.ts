import { describe, expect, it, vi } from 'vitest';
import {
  defaultEntityToTable,
  parseOrderBy,
  resolveEntityMapping,
  makeEntityApi,
} from '../src/entities.js';

describe('defaultEntityToTable', () => {
  it.each([
    ['Customer', 'customers'],
    ['Company', 'companies'],
    ['User', 'users'],
    ['ChartOfAccount', 'chart_of_accounts'],
    ['MeetingMinute', 'meeting_minutes'],
    ['Category', 'categories'],
    ['Address', 'addresses'],
    ['Match', 'matches'],
    ['UnitAvailability', 'unit_availabilities'],
  ])('%s -> %s', (input, expected) => {
    expect(defaultEntityToTable(input)).toBe(expected);
  });
});

describe('parseOrderBy', () => {
  it('handles ascending bare string', () => {
    expect(parseOrderBy('name')).toEqual({ field: 'name', ascending: true });
  });
  it('handles descending - prefix', () => {
    expect(parseOrderBy('-created_date')).toEqual({ field: 'created_date', ascending: false });
  });
  it('passes object through', () => {
    expect(parseOrderBy({ field: 'x', ascending: false })).toEqual({ field: 'x', ascending: false });
  });
  it('returns undefined for undefined', () => {
    expect(parseOrderBy(undefined)).toBeUndefined();
  });
});

describe('resolveEntityMapping', () => {
  it('routes shared entities to sharedSchema', () => {
    expect(
      resolveEntityMapping('Customer', { schemaPrefix: 'propertyflow' }),
    ).toEqual({ schema: 'core', table: 'customers' });
  });
  it('routes app-specific entities to schemaPrefix', () => {
    expect(
      resolveEntityMapping('Unit', { schemaPrefix: 'propertyflow' }),
    ).toEqual({ schema: 'propertyflow', table: 'units' });
  });
  it('honors entityMap override', () => {
    expect(
      resolveEntityMapping('Foo', {
        schemaPrefix: 'propertyflow',
        entityMap: { Foo: { schema: 'custom', table: 'foo_table' } },
      }),
    ).toEqual({ schema: 'custom', table: 'foo_table' });
  });
});

/** Mock SupabaseClient minimally to verify entity API translates calls correctly. */
function mockSupabase(opts?: { selectData?: unknown; throws?: Error }) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: opts?.selectData ?? null,
      error: opts?.throws ?? null,
    }),
    single: vi.fn().mockResolvedValue({
      data: opts?.selectData ?? null,
      error: opts?.throws ?? null,
    }),
    then: undefined as any,
  };
  // For "await query" without single/maybeSingle (list/filter).
  builder.then = (onResolve: any) =>
    Promise.resolve({ data: opts?.selectData ?? [], error: opts?.throws ?? null }).then(onResolve);

  const from = vi.fn(() => builder);
  const schema = vi.fn(() => ({ from }));
  return { client: { schema } as any, from, builder, schema };
}

describe('makeEntityApi', () => {
  it('list orders & limits', async () => {
    const { client, from, builder, schema } = mockSupabase({ selectData: [{ id: 1 }] });
    const api = makeEntityApi(client, { schema: 'core', table: 'customers' });
    const result = await api.list('-created_date', 10);
    expect(schema).toHaveBeenCalledWith('core');
    expect(from).toHaveBeenCalledWith('customers');
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.order).toHaveBeenCalledWith('created_date', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(10);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('filter applies eq for primitives', async () => {
    const { client, builder } = mockSupabase({ selectData: [] });
    const api = makeEntityApi(client, { schema: 'core', table: 'customers' });
    await api.filter({ status: 'active', vip: true });
    expect(builder.eq).toHaveBeenCalledWith('status', 'active');
    expect(builder.eq).toHaveBeenCalledWith('vip', true);
  });

  it('filter applies in for arrays', async () => {
    const { client, builder } = mockSupabase({ selectData: [] });
    const api = makeEntityApi(client, { schema: 'core', table: 'customers' });
    await api.filter({ id: ['a', 'b'] });
    expect(builder.in).toHaveBeenCalledWith('id', ['a', 'b']);
  });

  it('filter applies operator object', async () => {
    const { client, builder } = mockSupabase({ selectData: [] });
    const api = makeEntityApi(client, { schema: 'core', table: 'customers' });
    await api.filter({ amount: { op: 'gt', value: 100 } });
    expect(builder.gt).toHaveBeenCalledWith('amount', 100);
  });

  it('get returns single or null', async () => {
    const { client } = mockSupabase({ selectData: { id: 'x', name: 'A' } });
    const api = makeEntityApi(client, { schema: 'core', table: 'customers' });
    expect(await api.get('x')).toEqual({ id: 'x', name: 'A' });
  });

  it('create inserts and returns row', async () => {
    const { client, builder } = mockSupabase({ selectData: { id: 'x', name: 'A' } });
    const api = makeEntityApi(client, { schema: 'core', table: 'customers' });
    const created = await api.create({ name: 'A' });
    expect(builder.insert).toHaveBeenCalledWith({ name: 'A' });
    expect(created).toEqual({ id: 'x', name: 'A' });
  });

  it('update calls update + eq id', async () => {
    const { client, builder } = mockSupabase({ selectData: { id: 'x', name: 'B' } });
    const api = makeEntityApi(client, { schema: 'core', table: 'customers' });
    await api.update('x', { name: 'B' });
    expect(builder.update).toHaveBeenCalledWith({ name: 'B' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'x');
  });

  it('delete calls delete + eq id', async () => {
    const { client, builder } = mockSupabase();
    const api = makeEntityApi(client, { schema: 'core', table: 'customers' });
    await api.delete('x');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'x');
  });

  it('throws on supabase error', async () => {
    const err = new Error('boom');
    const { client } = mockSupabase({ throws: err });
    const api = makeEntityApi(client, { schema: 'core', table: 'customers' });
    await expect(api.list()).rejects.toBe(err);
  });
});
