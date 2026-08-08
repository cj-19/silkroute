import React from 'react';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

const pad = (n) => String(n).padStart(2, '0');
// Format natif de <input type="datetime-local"> : "YYYY-MM-DDTHH:mm"
const toLocalStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parseLocalStr = (s) => {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/**
 * Date + heure avec calendrier visuel, remplace les
 * `<input type="datetime-local">` dont le widget natif ne suit pas le theme
 * du site. Valeur/sortie au meme format que l'input natif ("YYYY-MM-
 * DDTHH:mm"), pour ne rien changer cote appelant ni cote backend.
 */
export default function DateTimePicker({ value, onChange, className = '', required, minDate }) {
  const selected = parseLocalStr(value);
  const fr = (typeof navigator !== 'undefined' && navigator.language || 'fr').startsWith('fr');

  const setDatePart = (d) => {
    const next = new Date(d);
    if (selected) next.setHours(selected.getHours(), selected.getMinutes());
    else next.setHours(12, 0);
    onChange(toLocalStr(next));
  };
  const setTimePart = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const base = selected || new Date();
    const next = new Date(base);
    next.setHours(h, m);
    onChange(toLocalStr(next));
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="input-dark flex-1 min-w-0 px-4 py-2 rounded-md flex items-center justify-between gap-2 text-left"
          >
            <span className={selected ? '' : 'text-[#71717A]'}>
              {selected ? selected.toLocaleDateString(fr ? 'fr-FR' : 'en-US') : (fr ? 'Choisir une date' : 'Pick a date')}
            </span>
            <CalendarIcon className="w-4 h-4 text-[#71717A] shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-[#141414] border-[#2A2A2A]">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => d && setDatePart(d)}
            disabled={(d) => minDate && d < parseLocalStr(minDate)}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <input
        type="time"
        value={selected ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : ''}
        onChange={(e) => e.target.value && setTimePart(e.target.value)}
        className="input-dark w-28 px-3 py-2 rounded-md shrink-0"
      />
      {required && <input type="datetime-local" value={value || ''} readOnly required className="sr-only" tabIndex={-1} />}
    </div>
  );
}
