import React, { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

/**
 * Selecteur de quantite.
 *
 * Le champ garde sa propre valeur TEXTE pendant la saisie : sans cela, vider le
 * champ le forcait aussitot a 1, et taper "20" apres effacement donnait "120".
 * La valeur numerique n'est remontee au parent que lorsqu'elle est valide, et
 * le recadrage entre min et max n'a lieu qu'a la sortie du champ (blur).
 */
export default function QuantityInput({
  value,
  onChange,
  min = 1,
  max = Infinity,
  className = '',
  inputClassName = 'w-20',
  disabled = false,
  'data-testid': testId,
}) {
  const [text, setText] = useState(String(value ?? min));

  // Resynchronise quand le parent change la valeur (ex: bornes recalculees)
  useEffect(() => {
    setText((current) => (Number(current) === value ? current : String(value)));
  }, [value]);

  // Si le groupage est complet, max peut tomber sous min : on ne descend jamais
  // en dessous de min, sinon la quantite afficherait 0.
  const clamp = (n) => Math.max(min, Math.min(Math.max(max, min), n));

  const commit = (raw) => {
    const parsed = parseInt(raw, 10);
    const next = clamp(Number.isNaN(parsed) ? min : parsed);
    setText(String(next));
    if (next !== value) onChange(next);
  };

  const step = (delta) => {
    const base = Number.isNaN(parseInt(text, 10)) ? value : parseInt(text, 10);
    const next = clamp(base + delta);
    setText(String(next));
    if (next !== value) onChange(next);
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    // On laisse le champ vide le temps de la saisie : c'est tout l'interet.
    if (raw === '') {
      setText('');
      return;
    }
    if (!/^\d+$/.test(raw)) return;
    setText(raw);
    const parsed = parseInt(raw, 10);
    // Remontee immediate uniquement si la valeur est deja dans les bornes,
    // pour que le prix se mette a jour en direct sans gener la frappe.
    if (parsed >= min && parsed <= max && parsed !== value) onChange(parsed);
  };

  const atMin = value <= min;
  const atMax = value >= max;
  const btn =
    'flex items-center justify-center w-9 h-9 rounded-md border border-[#2A2A2A] ' +
    'text-[#A1A1AA] hover:text-white hover:border-[#D4AF37] transition-colors ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#A1A1AA] ' +
    'disabled:hover:border-[#2A2A2A]';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={disabled || atMin}
        className={btn}
        aria-label="Diminuer la quantité"
      >
        <Minus className="w-4 h-4" />
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={text}
        onChange={handleChange}
        onBlur={(e) => commit(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(e.currentTarget.value); }
          if (e.key === 'ArrowUp') { e.preventDefault(); step(1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
        }}
        disabled={disabled}
        className={`input-dark px-3 py-2 rounded-md text-center ${inputClassName}`}
        data-testid={testId}
      />

      <button
        type="button"
        onClick={() => step(1)}
        disabled={disabled || atMax}
        className={btn}
        aria-label="Augmenter la quantité"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
