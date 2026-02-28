/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import QRAnalyzer from "./pages/QRAnalyzer";
import SecureLink from "./pages/SecureLink";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="qr" element={<QRAnalyzer />} />
          <Route path="link" element={<SecureLink />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
