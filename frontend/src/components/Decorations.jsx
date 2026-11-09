// Illustrations : SVG intégrés et émojis uniquement. Animations en CSS
// (transform / opacity), désactivées avec prefers-reduced-motion.

// Valeurs fixes (pas d'aléa au rendu) pour une neige régulière.
const FLAKES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 6 + ((i * 7) % 10),
  duration: 9 + ((i * 5) % 9),
  delay: -((i * 13) % 17),
  drift: ((i % 5) - 2) * 18,
  opacity: 0.45 + ((i * 3) % 5) / 10,
}));

export function Snow() {
  return (
    <div className="snow" aria-hidden="true">
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="flake"
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            '--drift': `${f.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

const BULB_COLORS = ['#E0B04A', '#FBF3E4', '#2E9E6A', '#FF5A5F'];

/** Guirlande lumineuse sous l'en-tête (assez large pour tous les écrans). */
export function Garland() {
  const step = 48;
  const count = 44;
  const width = step * count;
  let d = `M0 4`;
  for (let i = 0; i < count; i++) d += ` Q${i * step + step / 2} 22 ${(i + 1) * step} 4`;
  return (
    <svg
      className="garland"
      viewBox={`0 0 ${width} 34`}
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} fill="none" stroke="#2b1d14" strokeWidth="2" />
      {Array.from({ length: count }, (_, i) => {
        const x = i * step + step / 2;
        const color = BULB_COLORS[i % BULB_COLORS.length];
        return (
          <g key={i} transform={`translate(${x} 13)`}>
            <rect x="-3" y="0" width="6" height="5" rx="1" fill="#6b5b4f" />
            <ellipse
              className="bulb"
              style={{ animationDelay: `${(i % 7) * 0.35}s` }}
              cx="0"
              cy="12"
              rx="5.5"
              ry="8"
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Sapin décoré de l'écran de connexion. */
export function Tree() {
  return (
    <svg className="tree" viewBox="0 0 200 220" role="img" aria-label="Sapin de Noël décoré">
      <polygon className="tree-star" points="100,4 107,22 126,22 111,33 117,51 100,40 83,51 89,33 74,22 93,22" fill="#E0B04A" />
      <polygon points="100,38 140,92 60,92" fill="#1F6B4A" />
      <polygon points="100,62 158,134 42,134" fill="#1F6B4A" />
      <polygon points="100,94 178,182 22,182" fill="#1F6B4A" />
      <polygon points="100,38 140,92 120,92 100,60" fill="#174f37" />
      <polygon points="100,62 158,134 134,134 100,88" fill="#174f37" />
      <polygon points="100,94 178,182 150,182 100,122" fill="#174f37" />
      <path d="M72 84 Q100 98 130 82 M58 122 Q100 140 146 120 M40 170 Q100 190 164 168" fill="none" stroke="#E0B04A" strokeWidth="3" strokeLinecap="round" />
      <rect x="88" y="182" width="24" height="22" rx="3" fill="#6b3f22" />
      {[
        [86, 74, '#B3202A'], [118, 104, '#FBF3E4'], [70, 112, '#E0B04A'], [128, 150, '#B3202A'],
        [80, 154, '#FBF3E4'], [104, 128, '#B3202A'], [56, 172, '#E0B04A'], [146, 176, '#FBF3E4'],
      ].map(([cx, cy, fill], i) => (
        <circle key={i} className="ornament" style={{ animationDelay: `${i * 0.4}s` }} cx={cx} cy={cy} r="6" fill={fill} />
      ))}
      <rect x="30" y="196" width="34" height="20" rx="2" fill="#B3202A" />
      <rect x="44" y="196" width="6" height="20" fill="#E0B04A" />
      <rect x="138" y="192" width="30" height="24" rx="2" fill="#E0B04A" />
      <rect x="150" y="192" width="6" height="24" fill="#B3202A" />
    </svg>
  );
}

/** Nœud de ruban doré (bouton cadeau, cadeau qui s'ouvre). */
export function Bow({ className = 'bow' }) {
  return (
    <svg className={className} viewBox="0 0 120 60" aria-hidden="true" focusable="false">
      <path d="M60 44 C40 10 8 8 12 30 C16 50 44 48 60 44 Z" fill="#E0B04A" stroke="#a87d24" strokeWidth="3" />
      <path d="M60 44 C80 10 112 8 108 30 C104 50 76 48 60 44 Z" fill="#E0B04A" stroke="#a87d24" strokeWidth="3" />
      <circle cx="60" cy="44" r="10" fill="#f0c766" stroke="#a87d24" strokeWidth="3" />
    </svg>
  );
}

const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  x: ((i * 53) % 220) - 110,
  y: 120 + ((i * 29) % 160),
  rotate: (i * 67) % 360,
  delay: 0.35 + ((i * 7) % 10) / 20,
  color: i % 3 === 0 ? '#B3202A' : i % 3 === 1 ? '#E0B04A' : '#FBF3E4',
  wide: i % 2 === 0,
}));

export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className={c.wide ? 'confetto wide' : 'confetto'}
          style={{
            background: c.color,
            animationDelay: `${c.delay}s`,
            '--x': `${c.x}px`,
            '--y': `${c.y}px`,
            '--r': `${c.rotate + 540}deg`,
          }}
        />
      ))}
    </div>
  );
}
