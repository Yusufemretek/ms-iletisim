const SITE_URL = 'https://msiletisim.com';
const SITE_NAME = 'MS İletişim';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(id: string, data: Record<string, unknown>) {
  let el = document.head.querySelector(`script[data-jsonld="${id}"]`) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.setAttribute('data-jsonld', id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export interface SeoOptions {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'product' | 'article';
}

export function setSeoMeta(opts: SeoOptions) {
  const url = opts.path ? `${SITE_URL}${opts.path}` : SITE_URL;
  const image = opts.image ? (opts.image.startsWith('http') ? opts.image : `${SITE_URL}${opts.image}`) : DEFAULT_IMAGE;

  document.title = opts.title;
  setMeta('name', 'description', opts.description);
  setCanonical(url);

  setMeta('property', 'og:title', opts.title);
  setMeta('property', 'og:description', opts.description);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', image);
  setMeta('property', 'og:type', opts.type || 'website');
  setMeta('property', 'og:site_name', SITE_NAME);

  setMeta('name', 'twitter:title', opts.title);
  setMeta('name', 'twitter:description', opts.description);
  setMeta('name', 'twitter:image', image);
}

export function injectLocalBusinessJsonLd() {
  setJsonLd('organization', {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MS İletişim',
    legalName: 'MS İletişim',
    url: SITE_URL,
    logo: DEFAULT_IMAGE,
    image: DEFAULT_IMAGE,
    description: 'Niğde merkezli teknoloji mağazası. Sıfır ve ikinci el telefonlar, telefon aksesuarları, teknik servis, takas ve telefon alım hizmetleri.',
    telephone: '+905010311881',
    email: 'msiletisimnigde@gmail.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Yukarı Kayabaşı Mah. Cici Baba Sok. No: 1/B',
      addressLocality: 'Niğde',
      addressRegion: 'Niğde',
      postalCode: '51000',
      addressCountry: 'TR',
    },
    sameAs: [
      'https://www.instagram.com/msiletisim',
      'https://www.facebook.com/msiletisim',
    ],
  });

  setJsonLd('localbusiness', {
    '@context': 'https://schema.org',
    '@type': 'MobilePhoneStore',
    name: 'MS İletişim',
    alternateName: 'MS İletişim Niğde',
    description: 'Niğde merkezli teknoloji mağazası. Sıfır telefon, 2. el telefon, tablet, akıllı saat, aksesuar, teknik servis, takas ve telefon alım hizmetleri.',
    url: SITE_URL,
    image: DEFAULT_IMAGE,
    logo: DEFAULT_IMAGE,
    telephone: '+905010311881',
    email: 'msiletisimnigde@gmail.com',
    priceRange: '₺₺',
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 37.9667,
      longitude: 34.6833,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Yukarı Kayabaşı Mah. Cici Baba Sok. No: 1/B',
      addressLocality: 'Niğde',
      addressRegion: 'Niğde',
      postalCode: '51000',
      addressCountry: 'TR',
    },
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '09:00',
      closes: '19:00',
    }],
    areaServed: {
      '@type': 'City',
      name: 'Niğde',
    },
    sameAs: [
      'https://www.instagram.com/msiletisim',
      'https://www.facebook.com/msiletisim',
    ],
  });

  setJsonLd('website', {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MS İletişim',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/urunler?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  });
}

export interface ProductJsonLdOptions {
  name: string;
  description: string;
  price: number;
  currency?: string;
  availability: 'InStock' | 'OutOfStock';
  url: string;
  image?: string;
  brand?: string;
  category?: string;
}

export function injectProductJsonLd(opts: ProductJsonLdOptions) {
  setJsonLd('product', {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: opts.name,
    description: opts.description,
    image: opts.image ? (opts.image.startsWith('http') ? opts.image : `${SITE_URL}${opts.image}`) : undefined,
    brand: opts.brand ? { '@type': 'Brand', name: opts.brand } : undefined,
    category: opts.category,
    offers: {
      '@type': 'Offer',
      price: opts.price,
      priceCurrency: opts.currency || 'TRY',
      availability: opts.availability === 'InStock' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: opts.url,
      seller: {
        '@type': 'MobilePhoneStore',
        name: 'MS İletişim',
      },
    },
  });
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function injectBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  setJsonLd('breadcrumb', {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  });
}

export function removeBreadcrumbJsonLd() {
  const el = document.head.querySelector('script[data-jsonld="breadcrumb"]');
  if (el) el.remove();
}

export function removeProductJsonLd() {
  const el = document.head.querySelector('script[data-jsonld="product"]');
  if (el) el.remove();
}

export function setNoIndex() {
  let el = document.head.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', 'robots');
    document.head.appendChild(el);
  }
  el.setAttribute('content', 'noindex, nofollow');
}

export function setIndexable() {
  let el = document.head.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
  if (el) el.setAttribute('content', 'index, follow');
}
