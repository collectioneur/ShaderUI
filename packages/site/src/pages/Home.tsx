import React, { useState, useEffect } from "react";
import { Waterfall } from "../presets/Waterfall";
import { type FontConfig } from "shaderui";

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT,
  );
  useEffect(() => {
    const m = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(m.matches);
    m.addEventListener("change", onChange);
    onChange();
    return () => m.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

const sectionStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "48px 24px",
};

const subheadingStyle: React.CSSProperties = {
  fontSize: "1.125rem",
  color: "var(--text-muted)",
  margin: "0 0 48px",
};

const h2Style: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: "1.5rem",
  fontWeight: 600,
  margin: "0 0 12px",
  color: "var(--text)",
};

const pStyle: React.CSSProperties = {
  margin: "0 0 16px",
  color: "var(--text-muted)",
  lineHeight: 1.6,
};

const roadmapItemStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "flex-start",
  padding: "16px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const roadmapNumStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  background: "var(--text)",
  color: "var(--bg)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  flexShrink: 0,
};

const footerStyle: React.CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.08)",
  padding: "24px",
  textAlign: "center" as const,
  color: "var(--text-muted)",
  fontSize: "0.875rem",
};

export function Home() {
  const isMobile = useIsMobile();
  const titleFontSize = isMobile ? 48 : 120;
  const titlePadding = isMobile ? 300 : 1000;
  const titlePaddingSide = isMobile ? 50 : 400;

  return (
    <>
      <section style={{ ...sectionStyle, paddingTop: 256 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            position: "absolute",
            left: 0,
            right: 0,
            top: -titlePadding + 150,
          }}
        >
          <Waterfall
            text="shaderUI"
            font={
              {
                family: "Courier New",
                size: titleFontSize,
                weight: 200,
              } as FontConfig
            }
            padding={{
              paddingTop: titlePadding,
              paddingRight: titlePaddingSide,
              paddingBottom: titlePadding,
              paddingLeft: titlePaddingSide,
            }}
          />
        </div>
        <p style={subheadingStyle}>
          GPU-powered text and shader components for React. Build rich
          typography and effects with WebGPU.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>About</h2>
        <p style={pStyle}>
          ShaderUI is a library that lets you render text and custom shaders in
          the browser using WebGPU. This site is the playground and
          documentation for the project.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Install</h2>
        <p style={pStyle}>
          Install the library in your project. Documentation covers setup and
          integration in detail.
        </p>
        <pre
          style={{
            background: "var(--bg-elevated)",
            padding: "16px 20px",
            borderRadius: "var(--radius)",
            overflow: "auto",
            fontSize: "0.9rem",
            color: "var(--text)",
          }}
        >
          npm install @shaderui/lib
        </pre>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Links</h2>
        <p style={pStyle}>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          {" · "}
          <a href="#">Author</a>
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Philosophy</h2>
        <p style={pStyle}>
          Placeholder: project philosophy and design goals will be described
          here.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Roadmap</h2>
        <p style={{ ...pStyle, marginBottom: 24 }}>
          Planned milestones. Content to be filled later.
        </p>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[
            {
              num: "1",
              title: "Core library",
              desc: "SDF pipeline and ShaderCanvas",
            },
            {
              num: "2",
              title: "Examples & docs",
              desc: "Playground and documentation site",
            },
            {
              num: "3",
              title: "More presets",
              desc: "Additional shader examples",
            },
            { num: "4", title: "Stable API", desc: "Public release and npm" },
          ].map((item) => (
            <div key={item.num} style={roadmapItemStyle}>
              <span style={roadmapNumStyle}>{item.num}</span>
              <div>
                <strong
                  style={{
                    color: "var(--text)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  {item.title}
                </strong>
                <span
                  style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}
                >
                  {item.desc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer style={footerStyle}>
        © {new Date().getFullYear()} ShaderUI · GitHub · Author
      </footer>
    </>
  );
}
