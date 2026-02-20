interface Props {
  onClick?: () => void;
}

const LogoMark = ({ onClick }: Props) => (
  <button
    onClick={onClick}
    className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center select-none focus:outline-none"
    style={{ background: 'hsl(210, 65%, 60%)', cursor: onClick ? 'pointer' : 'default' }}
    tabIndex={-1}
    type="button"
  >
    <span className="text-white text-xs font-bold leading-none">T</span>
  </button>
);

export default LogoMark;
