import React from "react";

const sectionStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "48px 24px",
};

const h1Style: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: "2.25rem",
  fontWeight: 700,
  margin: "0 0 12px",
  color: "var(--text)",
};

const h2Style: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: "1.35rem",
  fontWeight: 600,
  margin: "32px 0 12px",
  color: "var(--text)",
};

const pStyle: React.CSSProperties = {
  margin: "0 0 16px",
  color: "var(--text-muted)",
  lineHeight: 1.6,
};

export function Documentation() {
  return (
    <>
      <section style={sectionStyle}>
        <h1 style={h1Style}>Documentation</h1>
        <p style={pStyle}>
          How to use ShaderUI in your project: setup, components, uniforms, and customization.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Connecting components</h2>
        <p style={pStyle}>
          Placeholder: step-by-step guide to installing the library and rendering your first ShaderCanvas component.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Creating and using uniforms</h2>
        <p style={pStyle}>
          Placeholder: how to define uniform bindings, pass values from React state, and use them in fragment shaders.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Customizing existing examples</h2>
        <p style={pStyle}>
          Placeholder: how to fork a preset (e.g. WaterReflection), change parameters, and adapt the shader to your needs.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Integrating into your project</h2>
        <p style={pStyle}>
          Placeholder: build setup (Vite, bundler config), TypeGPU integration, and best practices for production.
        </p>
      </section>
    </>
  );
}
