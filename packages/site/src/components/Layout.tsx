import { Outlet, NavLink } from "react-router-dom";

const nav = [
  { to: "/", label: "Home" },
  { to: "/examples", label: "Examples" },
  { to: "/documentation", label: "Documentation" },
] as const;

export function Layout() {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <NavLink
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
          }}
        >
          <img
            src="/shaderui-logo.png"
            alt="ShaderUI"
            style={{
              height: 36,
              width: "auto",
              display: "block",
              borderRadius: "var(--radius-sm)",
            }}
          />
        </NavLink>
        <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => (isActive ? "nav-link-active" : "")}
              style={({ isActive }) => ({
                padding: "8px 14px",
                borderRadius: "var(--radius-sm)",
                color: isActive ? undefined : "var(--text-muted)",
                textDecoration: "none",
                fontWeight: 500,
                textTransform: "capitalize",
                border: "1px solid transparent",
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
