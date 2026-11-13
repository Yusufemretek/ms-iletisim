import { useEffect, useState } from 'react';
import { FileText, Inbox, History, Shield, Plus, Eye, X, Check, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { LegalDocument, KvkkRequest, ConsentLog, UserLegalAcknowledgement, KvkkRequestStatus, LegalDocumentType } from '@/lib/types';

type Tab = 'documents' | 'requests' | 'consents' | 'acknowledgements';

export function AdminKvkkPage() {
  const [tab, setTab] = useState<Tab>('documents');
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [requests, setRequests] = useState<KvkkRequest[]>([]);
  const [consentLogs, setConsentLogs] = useState<ConsentLog[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<UserLegalAcknowledgement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<LegalDocument | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<KvkkRequest | null>(null);

  const loadAll = async () => {
    setLoading(true);
    const [docsRes, reqRes, logsRes, ackRes] = await Promise.all([
      supabase.from('legal_documents').select('*').order('created_at', { ascending: false }),
      supabase.from('kvkk_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('consent_logs').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('user_legal_acknowledgements').select('*').order('acknowledged_at', { ascending: false }).limit(200),
    ]);
    setDocuments((docsRes.data as LegalDocument[]) || []);
    setRequests((reqRes.data as KvkkRequest[]) || []);
    setConsentLogs((logsRes.data as ConsentLog[]) || []);
    setAcknowledgements((ackRes.data as UserLegalAcknowledgement[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const tabs: { key: Tab; label: string; icon: typeof FileText; count: number }[] = [
    { key: 'documents', label: 'KVKK Metinleri', icon: FileText, count: documents.length },
    { key: 'requests', label: 'KVKK Başvuruları', icon: Inbox, count: requests.length },
    { key: 'consents', label: 'İletişim İzinleri', icon: History, count: consentLogs.length },
    { key: 'acknowledgements', label: 'Onay Geçmişi', icon: Shield, count: acknowledgements.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">KVKK & İzin Yönetimi</h1>
        {tab === 'documents' && (
          <Button size="sm" onClick={() => { setEditingDoc(null); setShowDocModal(true); }}>
            <Plus className="h-4 w-4" /> Yeni Metin
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === key ? 'border-electric-500 text-electric-600' : 'border-transparent text-slate-500 hover:text-slate-600'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">{count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-electric-500" />
        </div>
      ) : (
        <>
          {tab === 'documents' && <DocumentsTab documents={documents} onEdit={(d) => { setEditingDoc(d); setShowDocModal(true); }} onReload={loadAll} />}
          {tab === 'requests' && <RequestsTab requests={requests} onSelect={setSelectedRequest} />}
          {tab === 'consents' && <ConsentsTab logs={consentLogs} />}
          {tab === 'acknowledgements' && <AcknowledgementsTab acknowledgements={acknowledgements} />}
        </>
      )}

      {showDocModal && (
        <DocumentModal doc={editingDoc} onClose={() => setShowDocModal(false)} onSaved={() => { setShowDocModal(false); loadAll(); }} />
      )}
      {selectedRequest && (
        <RequestDetailModal request={selectedRequest} onClose={() => setSelectedRequest(null)} onReload={loadAll} />
      )}
    </div>
  );
}

// =========================================================================
// Documents Tab
// =========================================================================
function DocumentsTab({ documents, onEdit, onReload }: { documents: LegalDocument[]; onEdit: (d: LegalDocument) => void; onReload: () => void }) {
  const typeLabels: Record<LegalDocumentType, string> = {
    kvkk_notice: 'KVKK Aydınlatma Metni',
    explicit_consent: 'Açık Rıza Metni',
    commercial_communication: 'Ticari İletişim Metni',
    privacy: 'Gizlilik Politikası',
  };

  const toggleActive = async (doc: LegalDocument) => {
    if (doc.is_active) {
      await supabase.from('legal_documents').update({ is_active: false }).eq('id', doc.id);
    } else {
      // Deactivate others of same type, then activate this one
      await supabase.from('legal_documents').update({ is_active: false }).eq('document_type', doc.document_type);
      await supabase.from('legal_documents').update({ is_active: true, published_at: new Date().toISOString() }).eq('id', doc.id);
    }
    onReload();
  };

  return (
    <div className="space-y-3">
      {documents.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">Henüz hukuki metin bulunmuyor.</p>
        </div>
      ) : (
        documents.map((doc) => (
          <div key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-700">{doc.title}</h3>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{typeLabels[doc.document_type]}</span>
                  <span className="rounded-md bg-electric-50 px-2 py-0.5 text-xs text-electric-600">v{doc.version}</span>
                  {doc.is_active ? (
                    <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600"><Check className="h-3 w-3" /> Aktif</span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs text-slate-400"><Clock className="h-3 w-3" /> Pasif</span>
                  )}
                </div>
                {doc.published_at && (
                  <p className="mt-1 text-xs text-slate-400">Yayın: {new Date(doc.published_at).toLocaleDateString('tr-TR')}</p>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => onEdit(doc)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-600">
                  <Eye className="h-4 w-4" />
                </button>
                <Button size="sm" variant={doc.is_active ? 'outline' : 'primary'} onClick={() => toggleActive(doc)}>
                  {doc.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// =========================================================================
// Requests Tab
// =========================================================================
function RequestsTab({ requests, onSelect }: { requests: KvkkRequest[]; onSelect: (r: KvkkRequest) => void }) {
  const subjectLabels: Record<string, string> = {
    info_request: 'Bilgi Talebi',
    correction: 'Düzeltme Talebi',
    deletion: 'Silme Talebi',
    preference_change: 'Tercih Değişikliği',
    other: 'Diğer',
  };
  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-500',
    in_review: 'bg-blue-50 text-blue-600',
    resolved: 'bg-emerald-50 text-emerald-600',
    rejected: 'bg-red-50 text-red-500',
  };
  const statusLabels: Record<string, string> = {
    pending: 'Beklemede',
    in_review: 'İnceleniyor',
    resolved: 'Çözüldü',
    rejected: 'Reddedildi',
  };

  return (
    <div className="space-y-3">
      {requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Inbox className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">Henüz KVKK başvurusu bulunmuyor.</p>
        </div>
      ) : (
        requests.map((req) => (
          <button
            key={req.id}
            onClick={() => onSelect(req)}
            className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-electric-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">{req.full_name}</p>
                <p className="text-xs text-slate-400">{req.email} {req.phone ? `· ${req.phone}` : ''}</p>
                <p className="mt-1 text-xs text-slate-500">{subjectLabels[req.subject] || req.subject}</p>
              </div>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${statusColors[req.status]}`}>
                {statusLabels[req.status]}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">{new Date(req.created_at).toLocaleString('tr-TR')}</p>
          </button>
        ))
      )}
    </div>
  );
}

// =========================================================================
// Consents Tab
// =========================================================================
function ConsentsTab({ logs }: { logs: ConsentLog[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-400">
              <th className="px-4 py-3 text-left font-medium">Kullanıcı</th>
              <th className="px-4 py-3 text-left font-medium">Tip</th>
              <th className="px-4 py-3 text-left font-medium">Kanal</th>
              <th className="px-4 py-3 text-left font-medium">Durum</th>
              <th className="px-4 py-3 text-left font-medium">Kaynak</th>
              <th className="px-4 py-3 text-left font-medium">Tarih</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Henüz izin kaydı bulunmuyor.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{log.user_id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-slate-600">{log.consent_type === 'commercial_communication' ? 'Ticari İletişim' : log.consent_type}</td>
                  <td className="px-4 py-3 text-slate-600">{log.channel ? log.channel.toUpperCase() : '-'}</td>
                  <td className="px-4 py-3">
                    {log.status === 'granted' ? (
                      <span className="flex items-center gap-1 text-emerald-600"><Check className="h-3 w-3" /> Verildi</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500"><X className="h-3 w-3" /> Geri Çekildi</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{log.source}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(log.created_at).toLocaleString('tr-TR')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================================
// Acknowledgements Tab
// =========================================================================
function AcknowledgementsTab({ acknowledgements }: { acknowledgements: UserLegalAcknowledgement[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-400">
              <th className="px-4 py-3 text-left font-medium">Kullanıcı</th>
              <th className="px-4 py-3 text-left font-medium">Doküman</th>
              <th className="px-4 py-3 text-left font-medium">Versiyon</th>
              <th className="px-4 py-3 text-left font-medium">Kaynak</th>
              <th className="px-4 py-3 text-left font-medium">Onay Tarihi</th>
            </tr>
          </thead>
          <tbody>
            {acknowledgements.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Henüz onay kaydı bulunmuyor.</td></tr>
            ) : (
              acknowledgements.map((ack) => (
                <tr key={ack.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{ack.user_id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-slate-600">{ack.document_id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-slate-600">v{ack.document_version}</td>
                  <td className="px-4 py-3 text-slate-500">{ack.source}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(ack.acknowledged_at).toLocaleString('tr-TR')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================================
// Document Modal
// =========================================================================
function DocumentModal({ doc, onClose, onSaved }: { doc: LegalDocument | null; onClose: () => void; onSaved: () => void }) {
  const [docType, setDocType] = useState<LegalDocumentType>(doc?.document_type || 'kvkk_notice');
  const [title, setTitle] = useState(doc?.title || '');
  const [content, setContent] = useState(doc?.content || '');
  const [version, setVersion] = useState(doc?.version || '1.0');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    if (doc) {
      await supabase.from('legal_documents').update({ document_type: docType, title, content, version }).eq('id', doc.id);
    } else {
      await supabase.from('legal_documents').insert({ document_type: docType, title, content, version, is_active: false });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={doc ? 'Metni Düzenle' : 'Yeni Hukuki Metin'} size="lg">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Metin Tipi</label>
          <select value={docType} onChange={(e) => setDocType(e.target.value as LegalDocumentType)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
            <option value="kvkk_notice">KVKK Aydınlatma Metni</option>
            <option value="explicit_consent">Açık Rıza Metni</option>
            <option value="commercial_communication">Ticari İletişim Metni</option>
            <option value="privacy">Gizlilik Politikası</option>
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Başlık</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" placeholder="Metin başlığı" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Versiyon</label>
            <input value={version} onChange={(e) => setVersion(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" placeholder="1.0" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">İçerik</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm resize-none" placeholder="Metin içeriği..." />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button className="flex-1" loading={saving} onClick={handleSave}>{doc ? 'Güncelle' : 'Oluştur'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// =========================================================================
// Request Detail Modal
// =========================================================================
function RequestDetailModal({ request, onClose, onReload }: { request: KvkkRequest; onClose: () => void; onReload: () => void }) {
  const [status, setStatus] = useState<KvkkRequestStatus>(request.status);
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || '');
  const [saving, setSaving] = useState(false);

  const subjectLabels: Record<string, string> = {
    info_request: 'Verilerim hakkında bilgi almak istiyorum',
    correction: 'Bilgilerimi düzeltmek istiyorum',
    deletion: 'Silme/yok etme talebi',
    preference_change: 'İletişim tercihlerimi değiştirmek istiyorum',
    other: 'Diğer',
  };

  const handleSave = async () => {
    setSaving(true);
    const updates: Record<string, unknown> = { status, admin_notes: adminNotes || null };
    if (status === 'resolved' || status === 'rejected') {
      updates.resolved_at = new Date().toISOString();
    }
    await supabase.from('kvkk_requests').update(updates).eq('id', request.id);
    setSaving(false);
    onReload();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="KVKK Başvuru Detayı" size="lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-400">Ad Soyad</p>
            <p className="text-sm text-slate-600">{request.full_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">E-posta</p>
            <p className="text-sm text-slate-600">{request.email}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Telefon</p>
            <p className="text-sm text-slate-600">{request.phone || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Başvuru Tarihi</p>
            <p className="text-sm text-slate-600">{new Date(request.created_at).toLocaleString('tr-TR')}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-400">Başvuru Konusu</p>
          <p className="text-sm text-slate-600">{subjectLabels[request.subject]}</p>
        </div>
        {request.description && (
          <div>
            <p className="text-xs text-slate-400">Açıklama</p>
            <p className="text-sm text-slate-600 rounded-xl bg-slate-50 p-3">{request.description}</p>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Durum</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as KvkkRequestStatus)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
            <option value="pending">Beklemede</option>
            <option value="in_review">İnceleniyor</option>
            <option value="resolved">Çözüldü</option>
            <option value="rejected">Reddedildi</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Admin Notları</label>
          <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm resize-none" placeholder="İç notlar..." />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Kapat</Button>
          <Button className="flex-1" loading={saving} onClick={handleSave}>Güncelle</Button>
        </div>
      </div>
    </Modal>
  );
}
