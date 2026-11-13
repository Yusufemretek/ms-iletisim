/*
# Fix push_subscriptions RLS: add UPDATE policy

The edge function uses the service role key (bypasses RLS), but having
an explicit UPDATE policy is good practice for client-side cleanup
and future use.
*/

CREATE POLICY "update_own_push_subs"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
