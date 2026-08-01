import React from "react";
import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import {
  LayoutDashboard,
  Users,
  Package,
  ClipboardList,
  FileText,
  Send,
  MessageCircle,
  Menu,
} from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Inventory from "./pages/Inventory";
import InventoryDetail from "./pages/InventoryDetail";
import Bills from "./pages/Bills";
import BulkSend from "./pages/BulkSend";
import WhatsAppSetup from "./pages/WhatsAppSetup";

const NAV = [
  {
    section: `Overview`,
    items: [{ to: "/", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    section: "Management",
    items: [
      { to: "/clients", icon: Users, label: "Clients" },
      { to: "/products", icon: Package, label: "Products" },
      { to: "/inventory", icon: ClipboardList, label: "Inventory" },
    ],
  },
  {
    section: "Billing",
    items: [
      { to: "/bills", icon: FileText, label: "Bills & Invoices" },
      {
        to: "/bulk-send",
        icon: Send,
        label: "Bulk Excel Send",
        highlight: true,
      },
    ],
  },
  {
    section: "WhatsApp",
    items: [
      { to: "/whatsapp-setup", icon: MessageCircle, label: "WA Setup & QR" },
    ],
  },
];

function Sidebar({ collapsed }) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <Link to="/" className="sidebar-logo">
        {collapsed ? (
          <div className="brand-mini">AP</div>
        ) : (
          <>
            <div className="brand">
              {" "}
              <span>Aavin Pattathari</span> Palagam
            </div>
            <div className="sub">Inventory Management</div>
          </>
        )}
      </Link>

      <nav className="sidebar-nav">
        {NAV.map((s) => (
          <div key={s.section}>
            <div className="nav-label">{s.section}</div>
            {s.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : ""}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `nav-item${isActive ? " active" : ""} ${item.highlight ? "highlight" : ""}`
                }
              >
                <item.icon className="nav-icon" size={15} />
                <span className="nav-text">{item.label}</span>
                {item.highlight && !collapsed && (
                  <span
                    style={{
                      marginLeft: "auto",
                      background: "#F59E0B",
                      color: "#fff",
                      fontSize: ".6rem",
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: 4,
                    }}
                  >
                    NEW
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        Aavin Store v2.0
        <br />© 2026 Pattathari Palagam
      </div>
    </aside>
  );
}

const TITLES = {
  "/": "Dashboard",
  "/clients": "Clients",
  "/products": "Products",
  "/inventory": "Daily Inventory",
  "/bills": "Bills & Invoices",
  "/bulk-send": "Bulk Excel → WhatsApp",
  "/whatsapp-setup": "WhatsApp Setup",
};

function Topbar({ collapsed, setCollapsed }) {
  const location = useLocation();
  return (
    <div className="topbar">
      <div className="menu-btn" onClick={() => setCollapsed(!collapsed)}>
        <Menu size={22} />
      </div>

      <div className="topbar-title">
        {TITLES[location.pathname] || "Aavin Pattathari Palagam"}
      </div>
      <div className="topbar-right">
        <span style={{ fontSize: ".72rem", color: "var(--gray400)" }}>
          {new Date().toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontSize: ".82rem", fontFamily: "Sora,sans-serif" },
        }}
      />
      <div className="app-shell">
        <Sidebar collapsed={collapsed} />
        <div className={`main-content ${collapsed ? "collapsed" : ""}`}>
          <Topbar collapsed={collapsed} setCollapsed={setCollapsed} />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/:id" element={<InventoryDetail />} />
            <Route path="/bills" element={<Bills />} />
            <Route path="/bulk-send" element={<BulkSend />} />
            <Route path="/whatsapp-setup" element={<WhatsAppSetup />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
