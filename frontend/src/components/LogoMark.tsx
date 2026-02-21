interface LogoMarkProps {
  onClick?: () => void;
}

function LogoMark({ onClick }: LogoMarkProps) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center select-none focus:outline-none"
      style={{ background: 'var(--accent)', cursor: onClick ? 'pointer' : 'default' }}
      tabIndex={-1}
      type="button"
    >
      <span className="text-white text-xs font-bold leading-none">T</span>
    </button>
  );
}

export default LogoMark;
