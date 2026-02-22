import { Outlet, NavLink } from "react-router-dom";

const nav = [
  { to: "/", label: "Home" },
  { to: "/examples", label: "Examples" },
  { to: "/documentation", label: "Documentation" },
] as const;

const HEADER_HEIGHT = 68;

export function Layout() {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      <header
        className="site-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
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
              style={() => ({
                padding: "8px 14px",
                borderRadius: "var(--radius-sm)",
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
      <main style={{ flex: 1, paddingTop: HEADER_HEIGHT }}>
        <Outlet />
      </main>
    </div>
  );
}
