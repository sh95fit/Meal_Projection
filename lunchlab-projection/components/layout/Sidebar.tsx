import Link from "next/link";

const menu = [
  { label: "대시보드", href: "/dashboard", icon: "📊" },
  { label: "발주 예측", href: "/forecast", icon: "📋" },
  { label: "고객사 관리", href: "/clients", icon: "🏢" },
  { label: "설정", href: "/settings", icon: "⚙️" },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-bold">🍱 발주예측</span>
      </div>
      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {menu.map((m) => (
            <li key={m.href}>
              <Link href={m.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <span>{m.icon}</span>{m.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
