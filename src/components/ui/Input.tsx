import { useEffect, useState, type ChangeEvent, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input(props: InputProps) {
  if (props.type === 'number') return <NumberInput {...props} />;
  return <BaseInput {...props} />;
}

function BaseInput({ label, error, className = '', id, ...rest }: InputProps) {
  const inputId = id || rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...rest}
        className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50 ${error ? 'border-red-400' : ''} ${className}`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Sayı alanı: kullanıcının yazdığı metni yerel olarak tutar. Böylece baştaki "0" silinebilir,
// alan boş bırakılabilir ve "05000" gibi baştaki sıfırlar otomatik temizlenir.
function NumberInput({ value, onChange, placeholder, ...rest }: InputProps) {
  const toText = (v: InputProps['value']) => (v === 0 || v === '0' || v == null ? '' : String(v));
  const [text, setText] = useState(() => toText(value));

  useEffect(() => {
    // Dışarıdan değer değiştiyse (form sıfırlama, kayıt düzenleme vb.) senkronize et
    if (Number(text || 0) !== Number(value || 0)) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    if (/^0\d/.test(raw)) raw = raw.replace(/^0+(?=\d)/, '');
    setText(raw);
    if (raw !== e.target.value) e.target.value = raw;
    onChange?.(e);
  };

  return <BaseInput {...rest} type="number" inputMode="decimal" value={text} onChange={handleChange} placeholder={placeholder ?? '0'} />;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', id, ...rest }: TextareaProps) {
  const inputId = id || rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        {...rest}
        className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 ${error ? 'border-red-400' : ''} ${className}`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

export function Select({ label, error, className = '', id, children, ...rest }: SelectProps) {
  const inputId = id || rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        id={inputId}
        {...rest}
        className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 ${error ? 'border-red-400' : ''} ${className}`}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
