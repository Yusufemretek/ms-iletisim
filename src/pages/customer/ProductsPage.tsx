import { useEffect, useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ProductCard } from '@/components/ProductCard';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getNavSeq } from '@/lib/router';
import { normalizeTurkish, matchesSearch } from '@/lib/search';
import { getActiveCampaigns, getCampaignForProduct, type Campaign } from '@/lib/campaigns';
import type { ProductWithImages, Category } from '@/lib/types';

export function ProductsPage({ query }: { query: URLSearchParams }) {
  const [products, setProducts] = useState<ProductWithImages[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(query.get('q') || '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState(query.get('type') || '');
  const [brandFilter, setBrandFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState('newest');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const isFirsat = query.get('firsat') === '1';

  useEffect(() => {
    const mySeq = getNavSeq();
    (async () => {
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase
          .from('products')
          .select('*, category:categories(*), product_images(*)')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
      ]);
      if (getNavSeq() !== mySeq) return;
      setCategories((cats as Category[]) || []);
      setProducts((prods as ProductWithImages[]) || []);
      const activeCampaigns = await getActiveCampaigns();
      if (getNavSeq() !== mySeq) return;
      setCampaigns(activeCampaigns);
      setLoading(false);
    })();
  }, []);

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.brand && set.add(p.brand));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let result = [...products];
    const typeLabels: Record<string, string> = {
      new_phone: 'sıfır telefon yeni telefon',
      used_phone: '2. el telefon ikinci el telefon',
      accessory: 'aksesuar aksesuar',
      tablet: 'tablet',
      smartwatch: 'akıllı saat saat',
    };
    if (search) {
      const q = normalizeTurkish(search);
      result = result.filter(
        (p) =>
          matchesSearch(q, p.name, p.brand, p.model, p.description, p.category?.name) ||
          normalizeTurkish(typeLabels[p.type] || '').includes(q),
      );
    }
    if (categoryFilter) result = result.filter((p) => p.category_id === categoryFilter);
    if (typeFilter) result = result.filter((p) => p.type === typeFilter);
    if (brandFilter) result = result.filter((p) => p.brand === brandFilter);
    if (stockFilter === 'in') result = result.filter((p) => p.stock > 0);
    if (stockFilter === 'out') result = result.filter((p) => p.stock === 0);
    if (isFirsat) {
      result = result.filter((p) => getCampaignForProduct(p.id, p.category_id, campaigns) !== null);
    }

    if (sort === 'price-asc') result.sort((a, b) => a.sale_price - b.sale_price);
    if (sort === 'price-desc') result.sort((a, b) => b.sale_price - a.sale_price);
    if (sort === 'newest') result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return result;
  }, [products, search, categoryFilter, typeFilter, brandFilter, stockFilter, sort, isFirsat, campaigns]);

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setTypeFilter('');
    setBrandFilter('');
    setStockFilter('');
    setSort('newest');
  };

  const hasFilters = search || categoryFilter || typeFilter || brandFilter || stockFilter;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">{isFirsat ? 'Fırsat Ürünleri' : 'Ürünler'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {filtered.length} ürün listeleniyor
        </p>
      </div>

      {/* Search + filter toggle */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Ürün, marka veya model ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
        <Button
          variant={showFilters ? 'primary' : 'outline'}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filtrele</span>
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Kategori"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">Tüm Kategoriler</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              label="Tür"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Tümü</option>
              <option value="new_phone">Sıfır Telefon</option>
              <option value="used_phone">2. El Telefon</option>
              <option value="accessory">Aksesuar</option>
              <option value="tablet">Tablet</option>
              <option value="smartwatch">Akıllı Saat</option>
            </Select>
            <Select
              label="Marka"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
            >
              <option value="">Tüm Markalar</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
            <Select
              label="Stok Durumu"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="">Tümü</option>
              <option value="in">Stokta Var</option>
              <option value="out">Stokta Yok</option>
            </Select>
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4" />
              Filtreleri Temizle
            </button>
          )}
        </div>
      )}

      {/* Sort */}
      <div className="mb-4 flex items-center justify-between">
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="max-w-48"
        >
          <option value="newest">En Yeni</option>
          <option value="price-asc">Fiyat: Artan</option>
          <option value="price-desc">Fiyat: Azalan</option>
        </Select>
      </div>

      {/* Products grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            {hasFilters ? 'Filtrelere uygun ürün bulunamadı.' : isFirsat ? 'Şu anda fırsat ürünü bulunmuyor. Yeni kampanyalar için takipte kalın!' : 'Henüz ürün eklenmemiş.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
