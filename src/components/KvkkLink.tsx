import { Shield } from 'lucide-react';
import { navigate } from '@/lib/router';

export function KvkkLink({ className = '' }: { className?: string }) {
  return (
    <button
      onClick={() => navigate('/kvkk')}
      className={`inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-electric-600 transition-colors ${className}`}
    >
      <Shield className="h-3.5 w-3.5" />
      Kişisel verilerin işlenmesine ilişkin bilgi için KVKK Aydınlatma Metni
    </button>
  );
}
