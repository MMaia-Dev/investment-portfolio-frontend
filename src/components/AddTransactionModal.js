import React, { useState } from "react";
import axios from "axios";
import "./AddTransactionModal.css";

export default function AddTransactionModal({
  isOpen,
  onClose,
  onTransactionAdded,
}) {
  const [isType, setIsType] = useState("buy"); // buy ou sell
  const [assetType, setAssetType] = useState("ETF"); // ETF (pode expandir para ações, criptos, etc.)
  const [asset, setAsset] = useState("VOO");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [otherCosts, setOtherCosts] = useState("");
  const [loading, setLoading] = useState(false);

  const ASSETS = ["VOO", "VXUS", "SCHD", "GLDM"];

  const calculateTotal = () => {
    const qtyNum = parseFloat(qty) || 0;
    const priceNum = parseFloat(price) || 0;
    const costsNum = parseFloat(otherCosts) || 0;
    const total = qtyNum * priceNum + costsNum;
    return total.toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!qty || !price) {
      alert("Please fill in quantity and price.");
      return;
    }

    setLoading(true);
    const backendUrl =
      process.env.REACT_APP_BACKEND_URL || "http://localhost:4000";

    try {
      const res = await axios.post(`${backendUrl}/api/transactions`, {
        asset_type: assetType,
        asset,
        transaction_type: isType,
        paid_at: paidAt,
        qty: parseFloat(qty),
        price: parseFloat(price),
        other_costs: parseFloat(otherCosts) || 0,
      });

      if (res.data.success) {
        // Reset form
        setQty("");
        setPrice("");
        setOtherCosts("");
        setPaidAt(new Date().toISOString().split("T")[0]);
        setAsset("VOO");

        // Notify parent component
        if (onTransactionAdded) {
          onTransactionAdded();
        }

        onClose();
      } else {
        alert("Error adding transaction: " + res.data.message);
      }
    } catch (err) {
      console.error("Error adding transaction:", err);
      alert("Error adding transaction");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Transaction</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="transaction-type-tabs">
          <button
            className={`tab ${isType === "buy" ? "active" : ""}`}
            onClick={() => setIsType("buy")}
          >
            💰 Buy
          </button>
          <button
            className={`tab ${isType === "sell" ? "active" : ""}`}
            onClick={() => setIsType("sell")}
          >
            📊 Sell
          </button>
        </div>

        <form onSubmit={handleSubmit} className="transaction-form">
          <div className="form-row">
            <div className="form-group">
              <label>Asset Type</label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                disabled
              >
                <option>ETF</option>
              </select>
            </div>

            <div className="form-group">
              <label>Asset</label>
              <select value={asset} onChange={(e) => setAsset(e.target.value)}>
                {ASSETS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Purchase Date</label>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Quantity</label>
              <input
                type="number"
                step="0.0001"
                placeholder="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Price($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Other Costs (Optional)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={otherCosts}
                onChange={(e) => setOtherCosts(e.target.value)}
              />
            </div>
          </div>

          <div className="total-section">
            <div className="total-label">Total Value</div>
            <div className="total-value">$ {calculateTotal()}</div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Сancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? "Adding..." : "+ Add Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
