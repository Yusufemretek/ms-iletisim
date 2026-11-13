/*
# Enable Supabase Realtime for chat_messages and notifications

1. Purpose
   supabase_realtime publication'ına chat_messages ve notifications tabloları eklenir.
   Bu tablolardaki INSERT/UPDATE/DELETE olayları realtime olarak frontend'e iletilir.

2. Changes
   - ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages
   - ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications
   - ALTER PUBLICATION supabase_realtime ADD TABLE public.orders
   - ALTER PUBLICATION supabase_realtime ADD TABLE public.service_records
*/
DO $$
BEGIN
  -- chat_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;

  -- notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  -- orders (for status changes)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  -- service_records (for status changes)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'service_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_records;
  END IF;
END $$;
