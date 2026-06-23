import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { format } from "date-fns";

export default function InventoryDetail() {
  const { id } = useParams();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .get(`/inventory/${id}`)
      .then((r) => {
        if (mounted) setEntry(r.data.data);
      })
      .catch((e) => toast.error(e.message || "Failed to load entry"))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading)
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    );
  if (!entry)
    return (
      <div className="page">
        <div className="empty">
          <p>Entry not found</p>
        </div>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Inventory Entry</div>
          <div className="page-sub">
            {format(new Date(entry.date), "dd/MM/yyyy")} — {entry.client?.name}
          </div>
        </div>
        <Link to="/inventory" className="btn btn-ghost">
          <ArrowLeft size={14} />
          Back
        </Link>
      </div>

      <div className="card">
        <div className="card-body">
          <div style={{ display: "grid", gap: 8 }}>
            {entry.lines.map((l, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--gray100)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{l.product?.name}</div>
                  <div className="text-sm text-muted">
                    {l.quantity} × ₹{l.priceAtTime}
                  </div>
                </div>
                <div style={{ fontWeight: 800 }}>
                  ₹{(l.quantity * l.priceAtTime).toFixed(2)}
                </div>
              </div>
            ))}
            <div
              style={{
                textAlign: "right",
                marginTop: 10,
                fontWeight: 800,
                fontSize: "1rem",
                color: "var(--navy)",
              }}
            >
              Total: ₹
              {entry.totalAmount?.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
