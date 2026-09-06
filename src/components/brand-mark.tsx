export function BrandMark() {
  return (
    <div className="brand-mark">
      <span className="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 54 54">
          <path d="M4 28 27 6l23 22" />
          <path className="brand-symbol-home" d="M12 25v24h30V25" />
          <path className="brand-symbol-accent" d="M35 13h8v8" />
          <circle className="brand-symbol-dot" cx="47" cy="49" r="3.5" />
        </svg>
      </span>
      <span className="brand-copy">
        <strong>PLIRIS</strong>
        <small>SOCIAL REVIEW HUB</small>
      </span>
    </div>
  );
}