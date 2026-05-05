# @cosolnergy2/base44-supabase-shim

Drop-in shim that exposes the **same surface as `@base44/sdk`** but routes
every call to a **self-hosted Supabase** backend (Postgres + gotrue + storage +
edge functions). Built so you swap one import in `src/api/base44Client.js` and
your hundreds of pages keep working.

## Install

In each consuming app, add as a git submodule (so air-gapped builds don't need
an npm registry):

```sh
git submodule add https://github.com/cosolnergy2/base44-supabase-shim.git vendor/base44-supabase-shim
```

In `package.json`:

```json
{
  "dependencies": {
    "@cosolnergy2/base44-supabase-shim": "file:./vendor/base44-supabase-shim",
    "@supabase/supabase-js": "^2.45.0"
  }
}
```

Build the shim once on the runner: `cd vendor/base44-supabase-shim && npm i && npm run build`.

## Use (browser / Vite app)

```js
// src/api/base44Client.js  — replace @base44/sdk import
import { createClient } from '@cosolnergy2/base44-supabase-shim';

export const base44 = createClient({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  schemaPrefix: 'propertyflow',          // app-specific schema
  sharedSchema: 'core',                  // shared entities live here
  // sharedEntities default: ['Customer','Company','User','Role','Department','Notification','AuditLog']
});

// Then everything in your existing pages keeps working:
const customers = await base44.entities.Customer.list('-created_date', 50);
const c = await base44.entities.Customer.get('uuid');
await base44.entities.Customer.update('uuid', { phone: '081...' });
await base44.entities.Unit.create({ unit_no: 'A-101' });
```

## Use (Supabase Edge Function — Deno)

```ts
import { createClientFromRequest } from 'npm:@cosolnergy2/base44-supabase-shim/server';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req, {
    supabaseUrl: Deno.env.get('SUPABASE_URL')!,
    supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
    supabaseServiceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    schemaPrefix: 'propertyflow',
  });

  const customers = await base44.asServiceRole.entities.Customer.filter(
    {},
    '-created_date',
    50,
  );
  return new Response(JSON.stringify({ data: customers }));
});
```

## Entity → table mapping

Default rule: PascalCase → snake_case + plural.
- `Customer` → `customers`
- `ChartOfAccount` → `chart_of_accounts`
- `MeetingMinute` → `meeting_minutes`

Override via `entityMap` if a real table doesn't follow the rule:

```js
createClient({
  ...,
  entityMap: {
    Customer: { schema: 'core', table: 'customers' },        // explicit
    Job: { schema: 'construction', table: 'project_jobs' },  // non-default name
  },
});
```

## Filter syntax

```js
// Equality (default)
await base44.entities.Customer.filter({ status: 'active', vip: true });

// IN (pass array)
await base44.entities.Customer.filter({ id: ['a', 'b', 'c'] });

// Operators
await base44.entities.Invoice.filter({
  amount: { op: 'gt', value: 1000 },
  customer_name: { op: 'ilike', value: '%co.%' },
});
```

Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`.

## Order by

- String form (Base44 convention): `'name'` ascending, `'-created_date'` descending.
- Object form: `{ field: 'name', ascending: false }`.

## What's NOT covered

- **Stripe / payments** — Base44 had managed integration; here, wire Stripe into
  edge functions yourself.
- **Email** — air-gapped LAN can't send mail by default; supply an internal
  SMTP relay or capture via inbucket.
- **AI / `InvokeLLM`** — out of scope (no Ollama in current target).
- **Schema discovery** — entity definitions must exist in Postgres first
  (separate migrations). The shim assumes tables exist with conventional names.

## Test

```sh
npm i
npm test       # vitest, mocked SupabaseClient
npm run build  # tsup → dist/
```
