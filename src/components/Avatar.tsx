/**
 * Avatar présentationnel : photo si disponible, sinon initiales sur dégradé.
 * `src` pointe vers la route proxy /api/personnel/[id]/photo (bucket privé).
 */
export function Avatar({
  src,
  initials,
  size = 40,
  className = "",
}: {
  src?: string | null;
  initials: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={initials}
        style={style}
        className={`flex-shrink-0 rounded-full object-cover ring-1 ring-sc-border ${className}`}
      />
    );
  }
  return (
    <div
      style={{ ...style, fontSize: Math.round(size * 0.38) }}
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sc-purple to-sc-blue font-semibold text-white ${className}`}
    >
      {initials}
    </div>
  );
}
