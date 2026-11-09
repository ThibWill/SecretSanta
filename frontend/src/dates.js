// L'API renvoie des dates UTC « YYYY-MM-DD HH:MM:SS ».
const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const dayYearFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function parseApiDate(s) {
  if (!s) return null;
  const d = new Date(`${s.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** « 20 novembre à 19:02 » (année ajoutée si ce n'est pas l'année en cours). */
export function formatDate(s) {
  const d = parseApiDate(s);
  if (!d) return '';
  const day = d.getFullYear() === new Date().getFullYear() ? dayFmt.format(d) : dayYearFmt.format(d);
  return `${day} à ${timeFmt.format(d)}`;
}
