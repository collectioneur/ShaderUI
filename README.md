# ShaderText

React library to render text as SDF (signed distance field) via Jump Flooding Algorithm and apply composable shaders (shape, color, interaction).

## Tech

- **TypeGPU** for WebGPU and shaders. See [docs.swmansion.com/TypeGPU/](https://docs.swmansion.com/TypeGPU/) and [docs/DEPS.md](docs/DEPS.md).

## Structure

- `packages/lib` — React library (`<ShaderText />`).
- `packages/site` — MVP playground (text/font/shaders UI, preview, copy component).

## Development

From repo root:

```bash
npm install
npm run build:lib   # build library first
npm run dev         # run playground (packages/site)
```

Build all: `npm run build`.
