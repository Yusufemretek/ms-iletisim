import { useEffect, useState, useCallback } from 'react';
import { Signal, Phone, X, Search, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/format';
import { LEAD_STATUS_LABELS, LEAD_STATUS_VARIANTS, REQUEST_TYPE_LABELS } from '@/lib/operator-campaigns';
import type { OperatorLeadStatus } from '@/lib/types';
import { trError } from '@/lib/errors';

interface AdminLead extends Record<string, unknown> {
  id: string;
  campaign_id: string;
  campaign_name: string;
  operator_id: string;
  operator_name: string;
  operator_color: string;
  user_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  current_operator: string | null;
  request_type: string;
  customer_note: string | null;
  admin_note: string | null;
  status: OperatorLeadStatus;
  created_at: string;
  updated_at: string;
}

const STATUS_FLOW: OperatorLeadStatus[] = ['new', 'contacted', 'waiting', 'completed', 'cancelled'];

export function AdminOperatorLeadsPage() {
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [editingLead, setEditingLead] = useState<AdminLead | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('get_admin_operator_leads');
    if (rpcError) {
      setError('Talepler yüklenemedi: ' + trError(rpcError));
    } else {
      setLeads((data as AdminLead[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = leads.filter(l => {
    if (filterStatus && l.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return l.full_name.toLowerCase().includes(q) || l.phone.includes(q) || (l.campaign_name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const openEdit = (lead: AdminLead) => {
    setEditingLead(lead);
    setAdminNote(lead.admin_note || '');
  };

  const handleUpdate = async (status: OperatorLeadStatus) => {
    if (!editingLead) return;
    setSaving(true);
    await supabase.rpc('update_operator_lead_status', {
      p_lead_id: editingLead.id,
      p_status: status,
      p_admin_note: adminNote || null,
    });
    setSaving(false);
    setEditingLead(null);
    load();
  };

  const handleDelete = async (leadId: string) => {
    setDeletingId(leadId);
    const { error: delError } = await supabase.rpc('delete_operator_lead', { p_lead_id: leadId });
    setDeletingId(null);
    if (delError) {
      setError('Talep silinemedi: ' + trError(delError));
    } else {
      load();
    }
  };

  const statusCounts = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Signal className="h-6 w-6 text-electric-600" /> Operatör Müşteri Talepleri
        </h1>
        <p className="mt-1 text-sm text-slate-500">Kampanya bilgi taleplerini yönetin</p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Status summary */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilterStatus('')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!filterStatus ? 'bg-electric-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          Tümü ({leads.length})
        </button>
        {STATUS_FLOW.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filterStatus === s ? 'bg-electric-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            {LEAD_STATUS_LABELS[s]} ({statusCounts[s] || 0})
          </button>
        ))}
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="İsim, telefon veya kampanya ara..." value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none" />
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Signal className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Talep bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(lead => (
            <div key={lead.id} className="premium-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: lead.operator_color }}>
                    {lead.operator_name?.[0] || '?'}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{lead.full_name}</p>
                      <Badge variant={LEAD_STATUS_VARIANTS[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{lead.operator_name} — {lead.campaign_name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-electric-600 hover:text-electric-700">
                        <Phone className="h-3.5 w-3.5" /> {lead.phone}
                      </a>
                      {lead.email && <span>{lead.email}</span>}
                      <span>İşlem: {REQUEST_TYPE_LABELS[lead.request_type] || lead.request_type}</span>
                      {lead.current_operator && <span>Mevcut: {lead.current_operator}</span>}
                    </div>
                    {lead.customer_note && (
                      <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-500">{lead.customer_note}</p>
                    )}
                    {lead.admin_note && (
                      <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-600">Admin Notu: {lead.admin_note}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-300">{formatDateTime(lead.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(lead)}>
                    Yönet
                  </Button>
                  <button
                    onClick={() => handleDelete(lead.id)}
                    disabled={deletingId === lead.id}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-40"
                    title="Talebi Sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setEditingLead(null)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl border border-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Talebi Yönet</h2>
              <button onClick={() => setEditingLead(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-slate-600">{editingLead.full_name}</p>
              <p className="text-xs text-slate-500">{editingLead.operator_name} — {editingLead.campaign_name}</p>
              <a href={`tel:${editingLead.phone}`} className="mt-1 flex items-center gap-1 text-sm text-electric-600 hover:text-electric-700">
                <Phone className="h-4 w-4" /> {editingLead.phone}
              </a>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Durum</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_FLOW.map(s => (
                  <button
                    key={s}
                    onClick={() => handleUpdate(s)}
                    disabled={saving}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${editingLead.status === s ? 'bg-electric-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                  >
                    {LEAD_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Admin Notu (müşteriye görünmez)</label>
              <textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                placeholder="örn: Müşteri arandı, yarın mağazaya gelecek."
              />
            </div>

            <Button className="w-full" loading={saving} onClick={() => handleUpdate(editingLead.status)}>
              <Save className="h-4 w-4" /> Notu Kaydet
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
