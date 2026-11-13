import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import { KvkkContent } from '@/components/KvkkContent';
import type { StoreSettings } from '@/lib/types';

export function KvkkPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('store_settings').select('*').limit(1).maybeSingle()
      .then(({ data }) => {
        setSettings(data as StoreSettings | null);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <button onClick={() => navigate('/')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-slate-800">KVKK Aydınlatma Metni</h1>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-electric-500" />
          </div>
        ) : (
          <KvkkContent settings={settings} />
        )}
      </div>
    </div>
  );
}
