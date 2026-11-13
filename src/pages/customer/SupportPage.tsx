import { useEffect, useState, useRef, useCallback } from 'react';
import { MessageCircle, Send, Headphones } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { navigate } from '@/lib/router';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ChatMessage {
  id: string;
  sender_type: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
}

export function SupportPage() {
  const { user, profile } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const knownMsgIds = useRef<Set<string>>(new Set());

  const appendMessage = useCallback((m: ChatMessage) => {
    setMessages(prev => {
      if (knownMsgIds.current.has(m.id)) return prev;
      knownMsgIds.current.add(m.id);
      return [...prev, m];
    });
  }, []);

  const loadOrCreateConversation = useCallback(async () => {
    if (!user) return;
    const { data: existing } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let convId: string;
    if (existing) {
      convId = (existing as { id: string }).id;
    } else {
      const { data: newConv, error } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          customer_name: (profile?.first_name || '') + ' ' + (profile?.last_name || ''),
          customer_email: profile?.email || user.email,
          status: 'OPEN',
        })
        .select()
        .single();
      if (error) { setLoading(false); return; }
      convId = (newConv as { id: string }).id;
    }
    setConversationId(convId);

    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('id, sender_type, message, image_url, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    const msgList = (msgs as ChatMessage[]) || [];
    knownMsgIds.current = new Set(msgList.map(m => m.id));
    setMessages(msgList);
    setLoading(false);
  }, [user, profile]);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    loadOrCreateConversation();
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [user, loadOrCreateConversation]);

  // Subscribe to realtime after conversationId is set
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          appendMessage(payload.new as ChatMessage);
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [conversationId, appendMessage]);

  // Fallback: poll for new messages every 5 seconds
  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(async () => {
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('id, sender_type, message, image_url, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (msgs) {
        const msgList = msgs as ChatMessage[];
        const newOnes = msgList.filter(m => !knownMsgIds.current.has(m.id));
        if (newOnes.length > 0) {
          newOnes.forEach(m => { knownMsgIds.current.add(m.id); });
          setMessages(msgList);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !conversationId || sending) return;
    setSending(true);
    const msg = input.trim();
    setInput('');
    const { data, error } = await supabase.rpc('send_chat_message', {
      p_conversation_id: conversationId,
      p_sender_type: 'customer',
      p_message: msg,
    });
    setSending(false);
    if (error) {
      setInput(msg);
      return;
    }
    const newMsg: ChatMessage = {
      id: (data as string) || crypto.randomUUID(),
      sender_type: 'customer',
      message: msg,
      image_url: null,
      created_at: new Date().toISOString(),
    };
    appendMessage(newMsg);
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Headphones className="h-6 w-6 text-electric-600" />
          Canlı Destek
        </h1>
        <p className="mt-1 text-sm text-slate-500">Bizimle mesajlaşın, en kısa sürede yanıtlayalım</p>
      </div>

      <div className="flex h-[60vh] flex-col rounded-2xl border border-slate-200 bg-white">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-electric-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <MessageCircle className="h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm text-slate-400">Henüz mesaj yok. Aşağıdan yazarak sohbete başlayın.</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${msg.sender_type === 'customer' ? 'bg-electric-500 text-white' : 'bg-slate-50 text-slate-600'}`}>
                  {msg.image_url && <img src={msg.image_url} alt="" className="mb-2 max-h-40 rounded-lg" />}
                  {msg.message && <p>{msg.message}</p>}
                  <p className={`mt-1 text-[10px] ${msg.sender_type === 'customer' ? 'text-electric-100' : 'text-slate-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Mesajınızı yazın..."
              className="input-dark flex-1 py-2.5 px-4 text-sm"
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500 text-white transition-colors hover:bg-electric-600 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
