import React from 'react';

/**
 * Rendu d'un corps de texte en markdown simplifie, sans dependance externe.
 *
 * Syntaxe supportee :
 *   ## Titre de section        -> <h2>
 *   ### Sous-titre             -> <h3>
 *   - element de liste         -> <ul><li>
 *   1. element numerote        -> <ol><li>
 *   | a | b |                  -> tableau (la ligne de separation |---| est ignoree)
 *   > citation                 -> encadre
 *   **gras** et *italique*
 *   [texte](/lien)
 *
 * Le HTML brut n'est jamais interprete : le texte est insere via les enfants
 * React, ce qui echappe automatiquement le contenu.
 */

// Découpe une ligne en fragments gras / italique / liens.
const renderInline = (text, keyPrefix) => {
  const parts = [];
  // Ordre important : le gras (**) avant l'italique (*)
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-i${i++}`;

    if (token.startsWith('**')) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('[')) {
      const label = token.slice(1, token.indexOf(']'));
      const href = token.slice(token.indexOf('](') + 2, -1);
      const external = /^https?:\/\//.test(href);
      parts.push(
        <a
          key={key}
          href={href}
          className="text-[#D4AF37] hover:underline"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {label}
        </a>
      );
    } else {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
};

const splitRow = (line) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

const RichText = ({ body }) => {
  if (!body) return null;

  const lines = String(body).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Titres
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h3 key={`h3-${i}`} className="text-white font-semibold text-base mt-6 mb-2 normal-case"
            style={{ fontFamily: 'DM Sans, sans-serif', textTransform: 'none', letterSpacing: 'normal' }}>
          {renderInline(trimmed.slice(4), `h3-${i}`)}
        </h3>
      );
      i += 1;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h2 key={`h2-${i}`} className="font-['Bebas_Neue'] text-2xl text-white mt-10 mb-3">
          {renderInline(trimmed.slice(3), `h2-${i}`)}
        </h2>
      );
      i += 1;
      continue;
    }

    // Tableau
    if (trimmed.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = splitRow(lines[i]);
        // Ignore la ligne de separation |---|---|
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i += 1;
      }
      if (rows.length) {
        const [head, ...bodyRows] = rows;
        blocks.push(
          <div key={`tbl-${i}`} className="overflow-x-auto my-6">
            <table className="table-dark text-sm">
              <thead>
                <tr>{head.map((c, ci) => <th key={ci}>{renderInline(c, `th-${i}-${ci}`)}</th>)}</tr>
              </thead>
              <tbody>
                {bodyRows.map((r, ri) => (
                  <tr key={ri}>{r.map((c, ci) => <td key={ci}>{renderInline(c, `td-${i}-${ri}-${ci}`)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Citation / encadre
    if (trimmed.startsWith('> ')) {
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quote.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push(
        <blockquote key={`bq-${i}`} className="border-l-2 border-[#D4AF37] bg-[#D4AF37]/5 pl-4 py-3 my-5 text-[#A1A1AA]">
          {renderInline(quote.join(' '), `bq-${i}`)}
        </blockquote>
      );
      continue;
    }

    // Liste a puces
    if (/^[-*] /.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) {
        items.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1.5 my-4 text-[#A1A1AA]">
          {items.map((it, idx) => <li key={idx}>{renderInline(it, `li-${i}-${idx}`)}</li>)}
        </ul>
      );
      continue;
    }

    // Liste numerotee
    if (/^\d+\.\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1.5 my-4 text-[#A1A1AA]">
          {items.map((it, idx) => <li key={idx}>{renderInline(it, `oli-${i}-${idx}`)}</li>)}
        </ol>
      );
      continue;
    }

    // Paragraphe : regroupe les lignes consecutives
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{2,3} |[-*] |\d+\.\s|\||> )/.test(lines[i].trim())
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={`p-${i}`} className="text-[#A1A1AA] leading-relaxed my-4">
        {renderInline(para.join(' '), `p-${i}`)}
      </p>
    );
  }

  return <div className="max-w-none">{blocks}</div>;
};

export default RichText;
