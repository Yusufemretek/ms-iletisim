/*
# Force RLS on chat tables for Realtime compatibility

Supabase Realtime requires FORCE ROW LEVEL SECURITY for postgres_changes
events to be properly filtered and delivered to authenticated clients.
*/
ALTER TABLE public.chat_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

-- Also set REPLICA IDENTITY FULL for better realtime support
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
