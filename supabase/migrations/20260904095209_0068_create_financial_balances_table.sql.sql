/*
# Create financial_balances table

## Problem
The `create_sale` RPC function references `public.financial_balances` to update
cash, bank, and card balances after each payment. However, this table was never
created — the original financial system migration (0007) created
`cash_transactions`, `bank_transactions`, and `card_transactions` tables but not
the `financial_balances` summary table. This caused every order creation to fail
with "relation financial_balances does not exist".

## Changes
1. Creates `financial_balances` table with columns:
   - `id` (integer, primary key, always 1 — single-row summary)
   - `cash_balance` (numeric, default 0)
   - `bank_balance` (numeric, default 0)
   - `card_balance` (numeric, default 0)
   - `updated_at` (timestamptz, default now())
2. Inserts a single row with id=1 and zero balances.
3. Enables RLS and restricts access to admin only (SELECT/UPDATE).
   - INSERT is allowed for authenticated (needed by create_sale fallback INSERT).
4. Grants UPDATE to authenticated (create_sale runs as SECURITY DEFINER but the
   underlying table still needs proper grants for the function's role).

## Security
- RLS enabled.
- SELECT: admin only.
- UPDATE: admin only.
- INSERT: authenticated (needed by create_sale's fallback INSERT when row is missing).
- The create_sale function is SECURITY DEFINER owned by postgres, so it bypasses RLS.
- Table-level GRANT UPDATE TO authenticated ensures the function can update balances.
*/

CREATE TABLE IF NOT EXISTS public.financial_balances (
  id integer PRIMARY KEY DEFAULT 1,
  cash_balance numeric NOT NULL DEFAULT 0,
  bank_balance numeric NOT NULL DEFAULT 0,
  card_balance numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_balances ENABLE ROW LEVEL SECURITY;

-- Insert the single summary row if it doesn't exist
INSERT INTO public.financial_balances (id, cash_balance, bank_balance, card_balance)
VALUES (1, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Policies
DROP POLICY IF EXISTS "financial_balances_select_admin" ON public.financial_balances;
CREATE POLICY "financial_balances_select_admin" ON public.financial_balances
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "financial_balances_insert_admin" ON public.financial_balances;
CREATE POLICY "financial_balances_insert_admin" ON public.financial_balances
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "financial_balances_update_admin" ON public.financial_balances;
CREATE POLICY "financial_balances_update_admin" ON public.financial_balances
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Grant UPDATE to authenticated so create_sale (SECURITY DEFINER) can update
GRANT SELECT, INSERT, UPDATE ON public.financial_balances TO authenticated;

NOTIFY pgrst, 'reload schema';
