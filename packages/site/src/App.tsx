import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Examples } from "./pages/Examples";
import { Documentation } from "./pages/Documentation";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="examples" element={<Examples />} />
        <Route path="documentation" element={<Documentation />} />
      </Route>
    </Routes>
  );
}
