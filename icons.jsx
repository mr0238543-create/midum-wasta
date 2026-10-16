// أيقونات SVG خفيفة (حدود فقط) — بلا اعتماديات خارجية
const P = (d) => <path d={d} />;

const ICONS = {
  home: P("M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"),
  search: <><circle cx="11" cy="11" r="7" />{P("M21 21l-4.3-4.3")}</>,
  user: <><circle cx="12" cy="8" r="4" />{P("M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7")}</>,
  phone: P("M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"),
  chat: P("M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"),
  pin: <>{P("M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z")}<circle cx="12" cy="9.5" r="2.5" /></>,
  star: P("M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.3l1.1-6.2L3 9.7l6.2-.9z"),
  heart: P("M12 20s-8-5-8-10.5A4.5 4.5 0 0112 7a4.5 4.5 0 018 2.5C20 15 12 20 12 20z"),
  bell: P("M6 17v-6a6 6 0 0112 0v6l2 2H4zM10 21h4"),
  plus: P("M12 5v14M5 12h14"),
  check: P("M5 12.5l4.5 4.5L19 7.5"),
  x: P("M6 6l12 12M18 6L6 18"),
  back: P("M4 12h16M14 6l6 6-6 6"),
  chevL: P("M15 5l-7 7 7 7"),
  chevDown: P("M6 9l6 6 6-6"),
  clock: <><circle cx="12" cy="12" r="9" />{P("M12 7v5l3 2")}</>,
  send: P("M21 3L10 14M21 3l-7 18-4-7-7-4z"),
  camera: <>{P("M4 8h3l2-3h6l2 3h3v11H4z")}<circle cx="12" cy="13" r="3.5" /></>,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" />{P("M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6")}</>,
  shield: P("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2.2 2.2L15.5 10"),
  store: P("M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9M10 20v-5h4v5"),
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  clipboard: P("M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4"),
  trash: P("M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"),
  edit: P("M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"),
  flag: P("M5 21V4M5 4h11l-2 4 2 4H5"),
  sliders: <>{P("M4 7h8M18 7h2M4 17h2M12 17h8")}<circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  logout: P("M10 4H5v16h5M15 8l4 4-4 4M19 12H9"),
  info: <><circle cx="12" cy="12" r="9" />{P("M12 11v5M12 8v.01")}</>,
  briefcase: P("M4 8h16v11H4zM9 8V5h6v3M4 13h16"),
  lock: P("M6 11h12v9H6zM8 11V8a4 4 0 018 0v3"),
  navigation: P("M12 3l7 17-7-4-7 4z"),
  locate: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" />{P("M12 1v3M12 20v3M1 12h3M20 12h3")}</>,
  image: P("M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5v.01"),
  alert: P("M12 3l10 18H2zM12 10v5M12 18v.01"),
  list: P("M8 6h13M8 12h13M8 18h13M3 6v.01M3 12v.01M3 18v.01"),
};

export default function Icon({ name, size = 20, stroke = 2, fill = "none", style, className }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ flexShrink: 0, ...style }} className={className}
    >
      {ICONS[name] || null}
    </svg>
  );
}
