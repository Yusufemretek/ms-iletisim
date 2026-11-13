import { useEffect, useState, useCallback, useRef } from 'react';
import { MessageCircle, Send, Headphones, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/format';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Conversation {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  last_message_at: string | null;
  created_at: string;
}

interface ChatMessage {
  id: string;
  sender_type: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
}

export function AdminSupportPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
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

  const loadConversations = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('chat_conversations').select('*').order('last_message_at', { ascending: false, nullsFirst: false });
    setConversations((data as Conversation[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Realtime: refresh conversation list when any conversation updates
  useEffect(() => {
    const channel = supabase
      .channel('admin-conv-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' },
        () => loadConversations()
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => loadConversations()
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [loadConversations]);

  const loadMessages = useCallback(async (convId: string) => {
    setSelectedConv(convId);
    const { data } = await supabase.from('chat_messages').select('id, sender_type, message, image_url, created_at').eq('conversation_id', convId).order('created_at', { ascending: true });
    const msgList = (data as ChatMessage[]) || [];
    knownMsgIds.current = new Set(msgList.map(m => m.id));
    setMessages(msgList);

    channelRef.current?.unsubscribe();
    const channel = supabase
      .channel(`admin-chat:${convId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${convId}` },
        (payload) => { appendMessage(payload.new as ChatMessage); }
      )
      .subscribe();
    channelRef.current = channel;
  }, [appendMessage]);

  // Fallback: poll for new messages every 5 seconds
  useEffect(() => {
    if (!selectedConv) return;
    const interval = setInterval(async () => {
      const { data: msgs } = await supabase.from('chat_messages').select('id, sender_type, message, image_url, created_at').eq('conversation_id', selectedConv).order('created_at', { ascending: true });
      if (msgs) {
        const msgList = msgs as ChatMessage[];
        const newOnes = msgList.filter(m => !knownMsgIds.current.has(m.id));
        if (newOnes.length > 0) {
          newOnes.forEach(m => knownMsgIds.current.add(m.id));
          setMessages(msgList);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedConv]);

  useEffect(() => {
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !selectedConv || sending) return;
    setSending(true);
    const msg = input.trim();
    setInput('');
    const { data, error } = await supabase.rpc('send_chat_message', {
      p_conversation_id: selectedConv,
      p_sender_type: 'admin',
      p_message: msg,
    });
    setSending(false);
    if (error) { setInput(msg); return; }
    const newMsg: ChatMessage = {
      id: (data as string) || crypto.randomUUID(),
      sender_type: 'admin',
      message: msg,
      image_url: null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => {
      if (prev.some(m => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });
    loadConversations();
  };

  const handleResolve = async () => {
    if (!selectedConv) return;
    await supabase.from('chat_conversations').update({ status: 'RESOLVED' }).eq('id', selectedConv);
    loadConversations();
    setSelectedConv(null);
    setMessages([]);
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-emerald-50 text-emerald-600';
      case 'WAITING_REPLY': return 'bg-amber-50 text-amber-500';
      case 'RESOLVED': return 'bg-slate-100 text-slate-400';
      default: return 'bg-slate-100 text-slate-400';
    }
  };

  const statusLabels: Record<string, string> = {
    OPEN: 'Açık', WAITING_REPLY: 'Yanıt Bekliyor', RESOLVED: 'Çözüldü',
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Headphones className="h-6 w-6 text-electric-600" /> Canlı Destek
        </h1>
        <p className="mt-1 text-sm text-slate-500">Müşteri destek konuşmaları</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Conversation list */}
        <div className="lg:col-span-1">
          <div className="premium-card overflow-hidden">
            <div className="border-b border-slate-200 p-3">
              <p className="text-sm font-bold text-slate-800">Konuşmalar ({conversations.length})</p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="space-y-2 p-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">Konuşma yok.</div>
              ) : (
                conversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => loadMessages(c.id)}
                    className={`flex w-full items-start gap-3 border-b border-slate-200 p-3 text-left transition-colors hover:bg-slate-50 ${selectedConv === c.id ? 'bg-electric-50' : ''}`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-electric-50 text-electric-600">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-medium text-slate-800">{c.customer_name || 'Müşteri'}</p>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusVariant(c.status)}`}>{statusLabels[c.status] || c.status}</span>
                      </div>
                      <p className="truncate text-xs text-slate-400">{c.customer_email}</p>
                      {c.last_message_at && <p className="text-[10px] text-slate-300">{formatDateTime(c.last_message_at)}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="lg:col-span-2">
          <div className="flex h-[65vh] flex-col rounded-2xl border border-slate-200 bg-white">
            {selectedConv ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-200 p-3">
                  <p className="text-sm font-bold text-slate-800">Sohbet</p>
                  <Button variant="outline" size="sm" onClick={handleResolve}>
                    <CheckCircle className="h-3.5 w-3.5" /> Çözüldü
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">Mesaj yok</div>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${msg.sender_type === 'admin' ? 'bg-electric-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {msg.image_url && <img src={msg.image_url} alt="" className="mb-2 max-h-40 rounded-lg" />}
                          {msg.message && <p>{msg.message}</p>}
                          <p className={`mt-1 text-[10px] ${msg.sender_type === 'admin' ? 'text-electric-100' : 'text-slate-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Mesaj yazın..."
                      className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 px-4 text-sm focus:border-slate-900 focus:outline-none"
                      disabled={sending}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500 text-white hover:bg-electric-600 disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <MessageCircle className="h-12 w-12 text-slate-300" />
                <p className="mt-3 text-sm text-slate-400">Bir konuşma seçin</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
