import { useEffect, useState, useCallback, useMemo } from 'react';
import { Signal, Search, SlidersHorizontal, X, ChevronRight, Wifi, Phone, MessageSquare, Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import { useAuth } from '@/context/AuthContext';
import type { Operator, OperatorCampaign, OperatorCampaignCategory } from '@/lib/types';
import { formatInternet, formatMinutes, formatSms, formatCommitment, formatPriceOrRequest, isCampaignExpired } from '@/lib/operator-campaigns';

type FilterOperator = string | null;
type FilterAction = string | null;
type FilterLineType = string | null;
type FilterInternet = string | null;

export function OperatorCampaignsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<OperatorCampaign[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [categories, setCategories] = useState<OperatorCampaignCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const [filterOperator, setFilterOperator] = useState<FilterOperator>(null);
  const [filterAction, setFilterAction] = useState<FilterAction>(null);
  const [filterLineType, setFilterLineType] = useState<FilterLineType>(null);
  const [filterInternet, setFilterInternet] = useState<FilterInternet>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const opId = params.get('operator');
    if (opId) setFilterOperator(opId);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: campData }, { data: opData }, { data: catData }] = await Promise.all([
      supabase.from('operator_campaigns').select('*, operator:operators(*), category:operator_campaign_categories(*)').eq('archived', false).eq('active', true).order('created_at', { ascending: false }),
      supabase.from('operators').select('*').eq('active', true).order('sort_order', { ascending: true }),
      supabase.from('operator_campaign_categories').select('*').eq('active', true).order('sort_order', { ascending: true }),
    ]);
    setCampaigns((campData as OperatorCampaign[]) || []);
    setOperators((opData as Operator[]) || []);
    setCategories((catData as OperatorCampaignCategory[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return campaigns.filter(c => {
      if (isCampaignExpired(c)) return false;
      if (filterOperator && c.operator_id !== filterOperator) return false;
      if (filterAction && !c.eligibility.includes(filterAction)) return false;
      if (filterLineType) {
        const hasElig = c.eligibility && c.eligibility.length > 0;
        if (filterLineType === 'prepaid' && hasElig && !c.eligibility.includes('prepaid')) return false;
        if (filterLineType === 'postpaid' && hasElig && !c.eligibility.includes('postpaid')) return false;
      }
      if (filterInternet) {
        if (filterInternet === 'unlimited') {
          if (!c.internet_unlimited) return false;
        } else {
          const min = parseInt(filterInternet);
          if (c.internet_unlimited) return true;
          if (c.internet_gb == null || c.internet_gb < min) return false;
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = `${c.name} ${c.short_description || ''} ${c.description || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [campaigns, filterOperator, filterAction, filterLineType, filterInternet, search]);

  const hasActiveFilters = filterOperator || filterAction || filterLineType || filterInternet;

  const clearFilters = () => {
    setFilterOperator(null);
    setFilterAction(null);
    setFilterLineType(null);
    setFilterInternet(null);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(22,139,255,0.08),_transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-8 sm:pt-14 sm:pb-10">
          <div className="flex items-center gap-2 text-xs font-medium text-electric-600">
            <Signal className="h-4 w-4" />
            <span>OPERATÖR KAMPANYALARI</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-slate-800 sm:text-3xl">Operatör Kampanyaları</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Size uygun güncel operatör kampanyalarını inceleyin ve detaylı bilgi için talep oluşturun.</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 pb-24 lg:pb-10">
        {/* Operator filter pills */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterOperator(null)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${!filterOperator ? 'bg-electric-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            Tümü
          </button>
          {operators.map(op => (
            <button
              key={op.id}
              onClick={() => setFilterOperator(filterOperator === op.id ? null : op.id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${filterOperator === op.id ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
              style={filterOperator === op.id ? { backgroundColor: op.color } : undefined}
            >
              {op.logo_url ? (
                <img src={op.logo_url} alt={op.name} className="h-4 w-4 rounded object-contain" />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: op.color }} />
              )}
              {op.name}
            </button>
          ))}
        </div>

        {/* Search + actions row */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Kampanya ara... (örn: 40 GB, numara taşıma)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-electric-500/50 focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-electric-50 text-electric-600' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtreler
            {hasActiveFilters && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-electric-500 px-1 text-xs font-bold text-white">!</span>}
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-electric-100 to-electric-50 px-4 py-2.5 text-sm font-medium text-electric-600 transition-colors hover:from-electric-200 hover:to-electric-100"
          >
            <Sparkles className="h-4 w-4" />
            Bana Uygun Tarifeyi Bul
          </button>
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-600">Filtreler</h3>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-electric-600 hover:text-electric-600">Temizle</button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">İşlem</label>
                <select
                  value={filterAction || ''}
                  onChange={e => setFilterAction(e.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-electric-500/50 focus:outline-none"
                >
                  <option value="">Tümü</option>
                  <option value="number_portability">Numara Taşıma</option>
                  <option value="new_line">Yeni Hat</option>
                  <option value="existing_customer">Mevcut Müşteri</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Hat Türü</label>
                <select
                  value={filterLineType || ''}
                  onChange={e => setFilterLineType(e.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-electric-500/50 focus:outline-none"
                >
                  <option value="">Tümü</option>
                  <option value="postpaid">Faturalı</option>
                  <option value="prepaid">Faturasız</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">İnternet</label>
                <select
                  value={filterInternet || ''}
                  onChange={e => setFilterInternet(e.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-electric-500/50 focus:outline-none"
                >
                  <option value="">Tümü</option>
                  <option value="10">10 GB+</option>
                  <option value="20">20 GB+</option>
                  <option value="40">40 GB+</option>
                  <option value="60">60 GB+</option>
                  <option value="100">100 GB+</option>
                  <option value="unlimited">Sınırsız</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Campaign grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-white" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
            <Signal className="h-12 w-12 text-slate-300" />
            <p className="mt-4 text-base font-semibold text-slate-600">Kampanya bulunamadı</p>
            <p className="mt-1 text-sm text-slate-400">
              {hasActiveFilters || search ? 'Filtreleri temizleyip tekrar deneyin.' : 'Henüz kampanya eklenmemiş.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(campaign => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>

      {/* Tariff finder wizard */}
      {showWizard && (
        <TariffWizard
          campaigns={campaigns}
          operators={operators}
          onClose={() => setShowWizard(false)}
          user={user}
        />
      )}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: OperatorCampaign }) {
  const op = campaign.operator;
  const cat = campaign.category;

  return (
    <div className="premium-card group flex flex-col overflow-hidden">
      {/* Operator bar */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          {op?.logo_url ? (
            <img src={op.logo_url} alt={op.name} className="h-6 w-6 rounded object-contain" />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: op?.color || '#6366f1' }}>
              {op?.name?.[0] || '?'}
            </span>
          )}
          <span className="text-sm font-semibold text-slate-600">{op?.name}</span>
        </div>
        {campaign.featured && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-500">Öne Çıkan</span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-4 py-4">
        <h3 className="text-base font-bold text-slate-800 break-words">{campaign.name}</h3>
        {cat && <span className="mt-1 block text-xs text-slate-400 break-words line-clamp-1">{cat.name}</span>}
        {campaign.short_description && <p className="mt-2 text-sm text-slate-500 line-clamp-2 break-words">{campaign.short_description}</p>}

        {/* Specs */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <SpecItem icon={Wifi} label={formatInternet(campaign)} />
          <SpecItem icon={Phone} label={formatMinutes(campaign)} />
          <SpecItem icon={MessageSquare} label={formatSms(campaign)} />
        </div>

        {/* Price */}
        <div className="mt-3">
          <p className="text-lg font-bold text-electric-600">{formatPriceOrRequest(campaign)}</p>
          <p className="mt-0.5 text-xs text-slate-400">{formatCommitment(campaign.commitment_months)} taahhüt</p>
        </div>

        {/* Buttons */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => navigate(`/operator-kampanyalari/${campaign.slug}`)}
            className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
          >
            Detayları Gör
          </button>
          <button
            onClick={() => navigate(`/operator-kampanyalari/${campaign.slug}?action=info`)}
            className="flex-1 rounded-lg bg-electric-50 py-2 text-sm font-medium text-electric-600 transition-colors hover:bg-electric-100"
          >
            Bilgi Al
          </button>
        </div>
      </div>
    </div>
  );
}

function SpecItem({ icon: Icon, label }: { icon: typeof Wifi; label: string }) {
  return (
    <div className="min-w-0 flex flex-col items-center gap-1 rounded-lg bg-slate-50 px-1 py-2">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="max-w-full break-words text-center text-[11px] font-medium leading-tight text-slate-600">{label}</span>
    </div>
  );
}

// =========================================================
// Tariff Finder Wizard
// =========================================================
type WizardStep = 0 | 1 | 2 | 3 | 4;

function TariffWizard({
  campaigns,
  operators,
  onClose,
  user,
}: {
  campaigns: OperatorCampaign[];
  operators: Operator[];
  onClose: () => void;
  user: ReturnType<typeof useAuth>['user'];
}) {
  const [step, setStep] = useState<WizardStep>(0);
  const [internet, setInternet] = useState<string>('');
  const [lineType, setLineType] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [budget, setBudget] = useState<string>('');

  const results = useMemo(() => {
    const filtered = campaigns.filter(c => {
      if (isCampaignExpired(c)) return false;
      if (internet === 'unlimited') {
        if (!c.internet_unlimited) return false;
      } else if (internet) {
        const min = parseInt(internet);
        if (c.internet_unlimited) return true;
        if (c.internet_gb == null || c.internet_gb < min) return false;
      }
      const hasEligibility = c.eligibility && c.eligibility.length > 0;
      if (lineType === 'postpaid' && hasEligibility && !c.eligibility.includes('postpaid')) return false;
      if (lineType === 'prepaid' && hasEligibility && !c.eligibility.includes('prepaid')) return false;
      if (action === 'number_portability' && hasEligibility && !c.eligibility.includes('number_portability')) return false;
      if (action === 'new_line' && hasEligibility && !c.eligibility.includes('new_line')) return false;
      if (budget) {
        const max = parseInt(budget);
        if (c.price_on_request || c.monthly_price == null) return false;
        if (Number(c.monthly_price) > max) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      const priceA = a.price_on_request || a.monthly_price == null ? Infinity : Number(a.monthly_price);
      const priceB = b.price_on_request || b.monthly_price == null ? Infinity : Number(b.monthly_price);
      return priceA - priceB;
    });
  }, [campaigns, internet, lineType, action, budget]);

  const steps = ['İnternet', 'Hat Türü', 'İşlem', 'Bütçe', 'Sonuçlar'];
  const canNext = step === 0 ? !!internet : step === 1 ? !!lineType : step === 2 ? !!action : true;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl border border-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-electric-600" />
            <h2 className="text-lg font-bold text-slate-800">Bana Uygun Tarifeyi Bul</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        {step < 4 && (
          <div className="mb-5 flex items-center gap-2">
            {steps.slice(0, 4).map((s, i) => (
              <div key={s} className="flex flex-1 flex-col items-center gap-1">
                <div className={`h-1.5 w-full rounded-full ${i <= step ? 'bg-electric-500' : 'bg-slate-200'}`} />
                <span className={`text-[10px] font-medium ${i <= step ? 'text-electric-600' : 'text-slate-300'}`}>{s}</span>
              </div>
            ))}
          </div>
        )}

        {/* Step 0: Internet */}
        {step === 0 && (
          <div className="space-y-2">
            <p className="mb-3 text-sm font-medium text-slate-600">Aylık yaklaşık ne kadar internet kullanıyorsunuz?</p>
            {[
              { val: '0', label: '0–10 GB' },
              { val: '10', label: '10–20 GB' },
              { val: '20', label: '20–40 GB' },
              { val: '40', label: '40–60 GB' },
              { val: '60', label: '60–100 GB' },
              { val: '100', label: '100 GB+' },
              { val: 'unlimited', label: 'Sınırsız istiyorum' },
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => setInternet(opt.val)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${internet === opt.val ? 'border-electric-500 bg-electric-50 text-electric-600' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 1: Line type */}
        {step === 1 && (
          <div className="space-y-2">
            <p className="mb-3 text-sm font-medium text-slate-600">Hat tercihiniz nedir?</p>
            {[
              { val: 'postpaid', label: 'Faturalı' },
              { val: 'prepaid', label: 'Faturasız' },
              { val: 'any', label: 'Fark etmez' },
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => setLineType(opt.val)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${lineType === opt.val ? 'border-electric-500 bg-electric-50 text-electric-600' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Action */}
        {step === 2 && (
          <div className="space-y-2">
            <p className="mb-3 text-sm font-medium text-slate-600">Ne yapmak istiyorsunuz?</p>
            {[
              { val: 'number_portability', label: 'Numaramı taşımak' },
              { val: 'new_line', label: 'Yeni hat almak' },
              { val: 'tariff_change', label: 'Mevcut tarifemi değiştirmek' },
              { val: 'browse', label: 'Sadece seçenekleri görmek' },
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => setAction(opt.val)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${action === opt.val ? 'border-electric-500 bg-electric-50 text-electric-600' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Budget */}
        {step === 3 && (
          <div className="space-y-2">
            <p className="mb-3 text-sm font-medium text-slate-600">Aylık bütçeniz nedir?</p>
            <p className="text-xs text-slate-400">İsteğe bağlı — atlayabilirsiniz.</p>
            {[
              { val: '250', label: '250 ₺\'ye kadar' },
              { val: '500', label: '500 ₺\'ye kadar' },
              { val: '750', label: '750 ₺\'ye kadar' },
              { val: '1000', label: '1000 ₺\'ye kadar' },
              { val: '', label: 'Sınırsız bütçe' },
            ].map(opt => (
              <button
                key={opt.val || 'none'}
                onClick={() => setBudget(opt.val)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${budget === opt.val ? 'border-electric-500 bg-electric-50 text-electric-600' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-700">Size Uygun Kampanyalar</h3>
              <span className="rounded-full bg-electric-50 px-2 py-0.5 text-xs font-medium text-electric-600">{results.length}</span>
            </div>

            {/* Summary of selections */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {internet && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">İnternet: {internet === 'unlimited' ? 'Sınırsız' : `${internet}+ GB`}</span>}
              {lineType && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">Hat: {lineType === 'postpaid' ? 'Faturalı' : lineType === 'prepaid' ? 'Faturasız' : 'Fark etmez'}</span>}
              {action && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">İşlem: {action === 'number_portability' ? 'Numara Taşıma' : action === 'new_line' ? 'Yeni Hat' : action === 'tariff_change' ? 'Tarife Değişikliği' : 'Göz Atma'}</span>}
              {budget && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">Bütçe: {budget} ₺'ye kadar</span>}
            </div>

            {results.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                <p className="text-sm text-slate-500">Seçimlerinize tam uyan kampanya bulunamadı.</p>
                <p className="mt-1 text-xs text-slate-400">Filtreleri değiştirip tekrar deneyebilir veya tüm kampanyalara göz atabilirsiniz.</p>
                <button onClick={onClose} className="mt-3 rounded-lg bg-electric-50 px-4 py-2 text-sm font-medium text-electric-600 hover:bg-electric-100">Tüm Kampanyalar</button>
              </div>
            ) : (
              <>
                {/* Comparison table - scrollable on mobile */}
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full min-w-[440px] border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="w-24 shrink-0 p-2 text-left text-[11px] font-semibold uppercase text-slate-400"></th>
                        {results.slice(0, 5).map((c, i) => (
                          <th key={c.id} className="p-2 text-center align-top">
                            <div className="flex flex-col items-center gap-1.5">
                              {c.operator?.logo_url ? (
                                <img src={c.operator.logo_url} alt={c.operator.name} className="h-8 w-8 rounded-lg object-contain" />
                              ) : (
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: c.operator?.color || '#6366f1' }}>
                                  {c.operator?.name?.[0] || '?'}
                                </span>
                              )}
                              <span className="text-[10px] font-medium text-slate-400">{c.operator?.name}</span>
                              {i === 0 && !c.price_on_request && c.monthly_price != null && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-600">EN UYGUN</span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-100">
                        <td className="p-2 text-[11px] font-semibold text-slate-400">Kampanya</td>
                        {results.slice(0, 5).map(c => (
                          <td key={c.id} className="p-2 text-center">
                            <button
                              onClick={() => { navigate(`/operator-kampanyalari/${c.slug}`); onClose(); }}
                              className="text-xs font-bold leading-tight text-slate-700 hover:text-electric-600 hover:underline"
                            >
                              {c.name}
                            </button>
                          </td>
                        ))}
                      </tr>
                      <tr className="border-t border-slate-100 bg-electric-50/40">
                        <td className="p-2 text-[11px] font-semibold text-slate-400">Fiyat</td>
                        {results.slice(0, 5).map(c => (
                          <td key={c.id} className="p-2 text-center">
                            <span className={`text-sm font-bold ${results.indexOf(c) === 0 && !c.price_on_request && c.monthly_price != null ? 'text-emerald-600' : 'text-electric-600'}`}>
                              {formatPriceOrRequest(c)}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr className="border-t border-slate-100">
                        <td className="p-2 text-[11px] font-semibold text-slate-400">İnternet</td>
                        {results.slice(0, 5).map(c => (
                          <td key={c.id} className="p-2 text-center text-xs font-medium text-slate-600">{formatInternet(c)}</td>
                        ))}
                      </tr>
                      <tr className="border-t border-slate-100">
                        <td className="p-2 text-[11px] font-semibold text-slate-400">Dakika</td>
                        {results.slice(0, 5).map(c => (
                          <td key={c.id} className="p-2 text-center text-xs font-medium text-slate-600">{formatMinutes(c)}</td>
                        ))}
                      </tr>
                      <tr className="border-t border-slate-100">
                        <td className="p-2 text-[11px] font-semibold text-slate-400">SMS</td>
                        {results.slice(0, 5).map(c => (
                          <td key={c.id} className="p-2 text-center text-xs font-medium text-slate-600">{formatSms(c)}</td>
                        ))}
                      </tr>
                      <tr className="border-t border-slate-100">
                        <td className="p-2 text-[11px] font-semibold text-slate-400">Taahhüt</td>
                        {results.slice(0, 5).map(c => (
                          <td key={c.id} className="p-2 text-center text-xs font-medium text-slate-600">{formatCommitment(c.commitment_months)}</td>
                        ))}
                      </tr>
                      <tr className="border-t border-slate-100">
                        <td className="p-2 text-[11px] font-semibold text-slate-400"></td>
                        {results.slice(0, 5).map(c => (
                          <td key={c.id} className="p-2 text-center">
                            <button
                              onClick={() => { navigate(`/operator-kampanyalari/${c.slug}`); onClose(); }}
                              className="rounded-lg bg-electric-50 px-3 py-1.5 text-[11px] font-medium text-electric-600 transition-colors hover:bg-electric-100"
                            >
                              Detay
                            </button>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setStep(0)}
                    className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Yeniden Dene
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-xl bg-electric-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-electric-600"
                  >
                    Tüm Kampanyalar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Nav buttons */}
        {step < 4 && (
          <div className="mt-5 flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1 as WizardStep)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                Geri
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => canNext && setStep(s => s + 1 as WizardStep)}
                disabled={!canNext}
                className="flex-1 rounded-xl bg-electric-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-electric-600 disabled:opacity-40"
              >
                Devam
              </button>
            ) : (
              <button
                onClick={() => setStep(4)}
                className="flex-1 rounded-xl bg-electric-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-electric-600"
              >
                Sonuçları Gör
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
