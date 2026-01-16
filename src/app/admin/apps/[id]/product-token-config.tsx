"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, RefreshCw, Coins } from "lucide-react";

interface ProductConfig {
  id: string;
  productId: string;
  tokenAmount: number;
  displayName: string | null;
  isActive: boolean;
  lastUpdatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  background: "rgba(39, 39, 42, 0.5)",
  border: "1px solid rgba(63, 63, 70, 0.6)",
  color: "#fafafa",
  fontSize: "14px",
  outline: "none",
};

const smallInputStyle = {
  ...inputStyle,
  padding: "10px 12px",
  fontSize: "13px",
};

export function ProductTokenConfig({ appId }: { appId: string }) {
  const [products, setProducts] = useState<ProductConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState({ productId: "", tokenAmount: 0, displayName: "" });
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/apps/${appId}/products`);
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.productId.trim() || newProduct.tokenAmount < 0) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/apps/${appId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: newProduct.productId.trim(),
          tokenAmount: newProduct.tokenAmount,
          displayName: newProduct.displayName.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add product");
      }

      await fetchProducts();
      setNewProduct({ productId: "", tokenAmount: 0, displayName: "" });
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProduct = async (productId: string, tokenAmount: number) => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/apps/${appId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, tokenAmount }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update product");
      }

      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm(`Delete product "${productId}"?`)) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/apps/${appId}/products/${encodeURIComponent(productId)}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete product");
      }

      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="glass" style={{ padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#9ca3af" }}>
          <Loader2 style={{ width: "20px", height: "20px" }} className="animate-spin" />
          Loading product configs...
        </div>
      </div>
    );
  }

  return (
    <div className="glass" style={{ padding: "28px" }}>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        paddingBottom: "20px", 
        borderBottom: "1px solid rgba(63, 63, 70, 0.4)",
        marginBottom: "24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Coins style={{ width: "20px", height: "20px", color: "#00f0ff" }} />
          <h2 style={{ fontWeight: "600", color: "#e4e4e7", fontSize: "16px" }}>
            Product Token Mapping
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={fetchProducts}
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              borderRadius: "10px",
              background: "rgba(39, 39, 42, 0.6)",
              border: "1px solid rgba(63, 63, 70, 0.5)",
              color: "#b8b8c8",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            <RefreshCw style={{ width: "14px", height: "14px" }} />
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              borderRadius: "10px",
              background: showAddForm ? "rgba(0, 240, 255, 0.15)" : "rgba(0, 240, 255, 0.1)",
              border: "1px solid rgba(0, 240, 255, 0.3)",
              color: "#00f0ff",
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            <Plus style={{ width: "16px", height: "16px" }} />
            Add Product
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: "14px 18px",
          borderRadius: "10px",
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          color: "#fca5a5",
          fontSize: "13px",
          marginBottom: "20px",
        }}>
          {error}
        </div>
      )}

      <p style={{ 
        fontSize: "13px", 
        color: "#9ca3af", 
        marginBottom: "20px",
        lineHeight: "1.6",
      }}>
        Configure how many tokens each in-app purchase product grants. 
        These values are automatically updated when RevenueCat sends{" "}
        <code style={{ 
          background: "rgba(39, 39, 42, 0.8)", 
          padding: "2px 6px", 
          borderRadius: "4px",
          fontSize: "12px",
        }}>
          VIRTUAL_CURRENCY_TRANSACTION
        </code>{" "}
        events. Manual changes will be overwritten by future webhook events.
      </p>

      {showAddForm && (
        <form onSubmit={handleAddProduct} style={{
          padding: "20px",
          borderRadius: "12px",
          background: "rgba(0, 240, 255, 0.05)",
          border: "1px solid rgba(0, 240, 255, 0.15)",
          marginBottom: "20px",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr auto", gap: "12px", alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "6px" }}>
                Product ID
              </label>
              <input
                type="text"
                placeholder="e.g., AIMusic.Tokens.100"
                value={newProduct.productId}
                onChange={(e) => setNewProduct({ ...newProduct, productId: e.target.value })}
                style={smallInputStyle}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "6px" }}>
                Tokens
              </label>
              <input
                type="number"
                min="0"
                placeholder="100"
                value={newProduct.tokenAmount || ""}
                onChange={(e) => setNewProduct({ ...newProduct, tokenAmount: parseInt(e.target.value) || 0 })}
                style={smallInputStyle}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "6px" }}>
                Display Name (optional)
              </label>
              <input
                type="text"
                placeholder="100 Token Pack"
                value={newProduct.displayName}
                onChange={(e) => setNewProduct({ ...newProduct, displayName: e.target.value })}
                style={smallInputStyle}
              />
            </div>
            <button
              type="submit"
              disabled={saving || !newProduct.productId.trim()}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 20px",
                borderRadius: "10px",
                background: saving ? "rgba(0, 240, 255, 0.3)" : "linear-gradient(135deg, #00f0ff 0%, #00b8cc 100%)",
                color: "#09090b",
                fontSize: "13px",
                fontWeight: "600",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
                height: "42px",
              }}
            >
              {saving ? <Loader2 style={{ width: "16px", height: "16px" }} className="animate-spin" /> : "Add"}
            </button>
          </div>
        </form>
      )}

      {products.length === 0 ? (
        <div style={{
          padding: "40px",
          textAlign: "center",
          color: "#71717a",
          background: "rgba(39, 39, 42, 0.3)",
          borderRadius: "12px",
          border: "1px dashed rgba(63, 63, 70, 0.5)",
        }}>
          <Coins style={{ width: "32px", height: "32px", margin: "0 auto 12px", opacity: 0.5 }} />
          <p style={{ fontSize: "14px", marginBottom: "8px" }}>No product configs yet</p>
          <p style={{ fontSize: "12px", color: "#52525b" }}>
            Add products manually or they will be auto-populated from RevenueCat events
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {products.map((product) => (
            <div
              key={product.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 120px 1.5fr auto auto",
                gap: "12px",
                alignItems: "center",
                padding: "16px 18px",
                borderRadius: "12px",
                background: "rgba(39, 39, 42, 0.4)",
                border: "1px solid rgba(63, 63, 70, 0.4)",
              }}
            >
              <div>
                <code style={{ 
                  fontSize: "13px", 
                  color: "#e4e4e7",
                  wordBreak: "break-all",
                }}>
                  {product.productId}
                </code>
                {product.displayName && (
                  <p style={{ fontSize: "11px", color: "#71717a", marginTop: "4px" }}>
                    {product.displayName}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="number"
                  min="0"
                  value={product.tokenAmount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setProducts(products.map(p => 
                      p.id === product.id ? { ...p, tokenAmount: value } : p
                    ));
                  }}
                  onBlur={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    if (value !== product.tokenAmount) {
                      handleUpdateProduct(product.productId, value);
                    }
                  }}
                  style={{ 
                    ...smallInputStyle, 
                    width: "80px",
                    textAlign: "right",
                  }}
                />
                <span style={{ fontSize: "12px", color: "#9ca3af" }}>tokens</span>
              </div>
              <div style={{ fontSize: "11px", color: "#71717a" }}>
                {product.lastUpdatedBy === "webhook" ? (
                  <span style={{ 
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "rgba(147, 51, 234, 0.15)",
                    color: "#c084fc",
                    fontSize: "10px",
                    fontWeight: "500",
                  }}>
                    Auto (webhook)
                  </span>
                ) : product.lastUpdatedBy === "admin" ? (
                  <span style={{ 
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "rgba(0, 240, 255, 0.1)",
                    color: "#00f0ff",
                    fontSize: "10px",
                    fontWeight: "500",
                  }}>
                    Manual
                  </span>
                ) : (
                  <span style={{ 
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "rgba(63, 63, 70, 0.4)",
                    fontSize: "10px",
                  }}>
                    Unknown
                  </span>
                )}
              </div>
              <div style={{ 
                fontSize: "10px", 
                color: "#52525b",
                whiteSpace: "nowrap",
              }}>
                {new Date(product.updatedAt).toLocaleDateString()}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteProduct(product.productId)}
                disabled={saving}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px",
                  borderRadius: "8px",
                  background: "transparent",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#f87171",
                  cursor: "pointer",
                }}
              >
                <Trash2 style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
