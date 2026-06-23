import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .get(`/products/${id}`)
      .then((r) => {
        if (mounted) setProduct(r.data.data);
      })
      .catch((e) => toast.error(e.message || "Failed to load product"))
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
  if (!product)
    return (
      <div className="page">
        <div className="empty">
          <p>Product not found</p>
        </div>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{product.name}</div>
          <div className="page-sub">
            Product code: {product.productCode || "—"}
          </div>
        </div>
        <Link to="/products" className="btn btn-ghost">
          <ArrowLeft size={14} />
          Back
        </Link>
      </div>

      <div className="card">
        <div className="card-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 200px",
              gap: 16,
            }}
          >
            <div>
              <div style={{ marginBottom: 12 }}>
                <strong>Category:</strong> {product.category}
              </div>
              <div style={{ marginBottom: 12 }}>
                <strong>Unit:</strong> {product.unit}
              </div>
              <div style={{ marginBottom: 12 }}>
                <strong>Price per unit:</strong> ₹
                {product.pricePerUnit?.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <div style={{ marginTop: 18 }}>
                <h4 style={{ marginBottom: 8 }}>Notes</h4>
                <div>{product.notes || "—"}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontSize: ".9rem", fontWeight: 700 }}>
                  Quick Info
                </div>
                <div style={{ marginTop: 8 }}>
                  Active: {product.active ? "Yes" : "No"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
