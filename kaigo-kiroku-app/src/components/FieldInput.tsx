import type { FieldDef, Lang } from '../types';
import { t } from '../i18n';

interface Props {
  def: FieldDef;
  value: string;
  lang: Lang;
  onChange: (v: string) => void;
}

const toHalf = (s: string) => s.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

export function FieldInput({ def, value, lang, onChange }: Props) {
  const wide = def.type === 'textarea' || def.type === 'text';
  let hint: { text: string; warn: boolean } | null = null;
  if (def.type === 'number' && def.normal) {
    const n = parseFloat(toHalf(value));
    const { min, max, note } = def.normal;
    if (!Number.isNaN(n) && ((min !== undefined && n < min) || (max !== undefined && n > max))) {
      hint = { text: `${t(lang, 'outOfRange')} ${note}`, warn: true };
    } else {
      const range = [min !== undefined ? `${min}` : '', max !== undefined ? `${max}` : ''].join('〜');
      hint = { text: `${t(lang, 'normalRange')}: ${range}${def.unit ?? ''}`, warn: false };
    }
  }

  return (
    <div className={`field${wide ? ' wide' : ''}`}>
      <label>
        {def.label}
        {def.unit && <span className="unit">({def.unit})</span>}
      </label>
      {def.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {def.options?.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : def.type === 'textarea' ? (
        <textarea value={value} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : def.type === 'time' ? (
        <input type="time" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : def.type === 'number' ? (
        <input type="number" inputMode="decimal" step="any" value={value} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type="text" value={value} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <div className={`hint${hint.warn ? ' warn' : ''}`}>{hint.text}</div>}
    </div>
  );
}
