import React from 'react';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDateStr = (s) => {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  return Number.isFinite(y) ? new Date(y, m - 1, d) : undefined;
};

/**
 * Champ date avec calendrier visuel, remplace les `<input type="date">`
 * dont le widget natif ne suit pas le theme du site et varie d'un
 * navigateur a l'autre. Valeur/sortie au format "YYYY-MM-DD", identique a
 * un input date natif pour ne rien changer cote appelant.
 */
export default function DatePicker({ value, onChange, placeholder, className = '', required, minDate, maxDate }) {
  const selected = parseDateStr(value);
  const fr = (typeof navigator !== 'undefined' && navigator.language || 'fr').startsWith('fr');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`input-dark w-full px-4 py-2 rounded-md flex items-center justify-between gap-2 text-left ${className}`}
        >
          <span className={selected ? '' : 'text-[#71717A]'}>
            {selected ? selected.toLocaleDateString(fr ? 'fr-FR' : 'en-US') : (placeholder || (fr ? 'Choisir une date' : 'Pick a date'))}
          </span>
          <CalendarIcon className="w-4 h-4 text-[#71717A] shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-[#141414] border-[#2A2A2A]">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => d && onChange(toDateStr(d))}
          disabled={(d) => (minDate && d < parseDateStr(minDate)) || (maxDate && d > parseDateStr(maxDate))}
          initialFocus
        />
      </PopoverContent>
      {/* Champ cache : garde la semantique HTML "required" pour la validation
          native du formulaire, sans afficher le widget natif par-dessus. */}
      {required && <input type="date" value={value || ''} readOnly required className="sr-only" tabIndex={-1} />}
    </Popover>
  );
}
