import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./Portfolio.css";
import AddTransactionModal from "./AddTransactionModal";

const TARGETS = { VOO: 0.5, VXUS: 0.3, SCHD: 0.15, GLDM: 0.05 };
const MONTHLY_APORTE = 2000;
const COLORS = ["#00C49F", "#0088FE", "#FFBB28", "#FF8042"];

export default function Portfolio() {
  const [prices, setPrices] = useState({});
  const [shares, setShares] = useState({ VOO: 0, VXUS: 0, SCHD: 0, GLDM: 0 });
  const [portfolio, setPortfolio] = useState({});
  const [portfolioData, setPortfolioData] = useState([]);
  const [profitMethod, setProfitMethod] = useState("change");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);

  const backendUrl =
    process.env.REACT_APP_BACKEND_URL || "http://localhost:4000";

  const fetchPortfolio = async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/portfolio`);
      if (res.data.success) {
        setPortfolioData(res.data.data);

        const sharesFromDb = {};
        const pricesFromDb = {};

        res.data.data.forEach((row) => {
          sharesFromDb[row.etf] = Number(row.shares);
          pricesFromDb[row.etf] = row.currentPrice;
        });

        // setShares(sharesFromDb);
        setPrices(pricesFromDb);
      } else {
        console.error("Failed to fetch shares:", res.data.message);
      }
    } catch (err) {
      console.error("Error fetching shares:", err);
    }
  };

  useEffect(() => {
    fetchPortfolio();
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/transactions`);
      if (res.data.success) {
        const transactionsData = res.data.data;

        setTransactions(transactionsData);

        // FIX: recalcula shares do zero para evitar duplicação
        const calculatedShares = { VOO: 0, VXUS: 0, SCHD: 0, GLDM: 0 };

        transactionsData.forEach((transaction) => {
          if (transaction.transaction_type === "buy") {
            calculatedShares[transaction.asset] =
              (calculatedShares[transaction.asset] || 0) + transaction.qty;
          } else if (transaction.transaction_type === "sell") {
            calculatedShares[transaction.asset] =
              (calculatedShares[transaction.asset] || 0) - transaction.qty;
          }
        });

        setShares(calculatedShares);
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  useEffect(() => {
    if (Object.keys(prices).length > 0) computePortfolio();
  }, [prices, shares]);

  const computePortfolio = () => {
    let totalValue = 0;
    const temp = {};

    Object.keys(TARGETS).forEach((etf) => {
      const value = (shares[etf] || 0) * (prices[etf] || 0);
      temp[etf] = { price: prices[etf], shares: shares[etf], value };
      totalValue += value;
    });

    Object.keys(TARGETS).forEach((etf) => {
      const weight = totalValue > 0 ? temp[etf].value / totalValue : 0;
      const gap = TARGETS[etf] - weight;

      const positiveGaps = Object.keys(TARGETS).reduce(
        (acc, e) =>
          acc + Math.max(TARGETS[e] - (temp[e].value / totalValue || 0), 0),
        0,
      );

      const buyUSD =
        gap > 0 && positiveGaps > 0 ? (gap / positiveGaps) * MONTHLY_APORTE : 0;

      const buyShares = buyUSD / temp[etf].price || 0;

      temp[etf] = { ...temp[etf], weight, gap, buyUSD, buyShares };
    });

    setPortfolio(temp);
  };

  const getTotalValue = () => {
    if (!portfolioData || portfolioData.length === 0) return 0;

    const total = portfolioData.reduce((sum, item) => {
      const value = (item.currentPrice || 0) * item.shares;
      return sum + value;
    }, 0);

    return total;
  };

  const getTotalProfit = () => {
    if (!portfolioData || portfolioData.length === 0) return 0;

    const total = portfolioData.reduce((sum, item) => {
      let profit = 0;

      switch (profitMethod) {
        case "change":
          profit = item.profitFromChange || 0;
          break;
        case "prevClose":
          profit = item.profitFromPrevClose || 0;
          break;
        case "averageCost":
          profit = item.profitFromAverageCost || 0;
          break;
        case "percent":
          const estimatedInvested =
            (item.currentPrice || 0) / (1 + (item.percentChange || 0) / 100);
          profit = (item.currentPrice - estimatedInvested) * item.shares;
          break;
        default:
          profit = 0;
      }

      return sum + profit;
    }, 0);

    return total;
  };

  const getTotalInvestedValue = () => {
    if (!transactions || transactions.length === 0) return 0;

    return transactions.reduce((sum, transaction) => {
      if (transaction.transaction_type === "buy") {
        return (
          sum +
          (transaction.qty * transaction.price + (transaction.other_costs || 0))
        );
      } else if (transaction.transaction_type === "sell") {
        return sum - transaction.qty * transaction.price;
      }
      return sum;
    }, 0);
  };

  const sumSharesFromTransactions = (etf, transactions) => {
    return transactions.reduce((total, transaction) => {
      if (transaction.asset === etf) {
        if (transaction.transaction_type === "buy") {
          return total + transaction.qty;
        } else if (transaction.transaction_type === "sell") {
          return total - transaction.qty;
        }
      }
      return total;
    }, 0);
  };

  const getReturnPercentage = () => {
    const totalValue = getTotalValue();
    const investedValue = getTotalInvestedValue();

    if (investedValue === 0) return 0;
    return ((totalValue - investedValue) / investedValue) * 100;
  };

  const getChartData = () => {
    return Object.keys(TARGETS).map((etf) => ({
      name: etf,
      value: portfolio[etf]?.value || 0,
    }));
  };

  const totalValue = getTotalValue();
  const totalProfit = getTotalProfit();

  return (
    <div className="portfolio-container">
      {/* Header */}
      <div className="portfolio-header">
        <h1>Investment Portfolio</h1>
        <div className="header-controls">
          <div className="profit-method-selector">
            <label htmlFor="profit-method">Profit Calculation:</label>
            <select
              id="profit-method"
              value={profitMethod}
              onChange={(e) => setProfitMethod(e.target.value)}
              className="profit-select"
            >
              <option value="change">Daily Change (d)</option>
              <option value="prevClose">From Previous Close (pc)</option>
              <option value="averageCost">From Average Cost</option>
              <option value="percent">Percent Change (dp)</option>
            </select>
          </div>

          <button className="refresh-btn" onClick={fetchPortfolio}>
            Refresh Prices
          </button>

          <button
            className="add-transaction-btn"
            onClick={() => setIsModalOpen(true)}
          >
            + Add Transaction
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Assets</div>

          <div className="stat-value-with-return">
            <div className="stat-value">${totalValue.toFixed(2)}</div>

            <div
              className="return-percentage"
              style={{
                color: getReturnPercentage() >= 0 ? "#00c49f" : "#ff8042",
              }}
            >
              {getReturnPercentage() >= 0 ? "+" : ""}
              {getReturnPercentage().toFixed(2)}%
            </div>
          </div>

          <div className="stat-subtext">
            Valor investido: ${getTotalInvestedValue().toFixed(2)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Portfolio Weight</div>
          <div className="stat-value">100%</div>
          <div className="stat-subtext">{Object.keys(TARGETS).length} ETFs</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Profit</div>
          <div
            className="stat-value"
            style={{ color: totalProfit >= 0 ? "#00c49f" : "#ff8042" }}
          >
            ${totalProfit.toFixed(2)}
          </div>

          <div className="stat-subtext">
            {profitMethod === "change" && "Based on daily change (d)"}
            {profitMethod === "prevClose" && "From previous close (pc)"}
            {profitMethod === "averageCost" && "From average cost"}
            {profitMethod === "percent" && "Based on % change (dp)"}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Monthly Contribution</div>
          <div className="stat-value">${MONTHLY_APORTE.toFixed(2)}</div>
          <div className="stat-subtext">Rebalancing Budget</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container">
          <h2>Portfolio Composition</h2>

          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={getChartData()}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: $${value.toFixed(0)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>

              <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table Section */}
      <div className="table-section">
        <h2>My Assets</h2>

        <div className="table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Qty</th>
                <th>Current Price</th>
                <th>Total Value</th>
                <th>Weight %</th>
                <th>Target %</th>
                <th>Gap %</th>
                <th>Buy Value</th>
                <th>Buy Qty</th>
              </tr>
            </thead>

            <tbody>
              {Object.keys(TARGETS).map((etf) => {
                const weight = portfolio[etf]?.weight || 0;
                const target = TARGETS[etf];
                const gap = portfolio[etf]?.gap || 0;
                const gapPercent = Math.abs(gap) > 0.01;

                return (
                  <tr key={etf} className={gapPercent ? "gap-row" : ""}>
                    <td className="asset-name">
                      <strong>{etf}</strong>
                    </td>

                    <td>{sumSharesFromTransactions(etf, transactions)}</td>

                    <td>${portfolio[etf]?.price?.toFixed(2) || "-"}</td>
                    <td>${portfolio[etf]?.value?.toFixed(2) || "-"}</td>

                    <td>
                      <span
                        className={` ${
                          weight > target
                            ? "overweight"
                            : weight < target
                              ? "underweight"
                              : ""
                        }`}
                      >
                        {(weight * 100).toFixed(2)}%
                      </span>
                    </td>

                    <td>{(target * 100).toFixed(1)}%</td>

                    <td>
                      <span
                        className={`gap ${
                          gap > 0 ? "positive" : gap < 0 ? "negative" : ""
                        }`}
                      >
                        {(gap * 100).toFixed(2)}%
                      </span>
                    </td>

                    <td>${portfolio[etf]?.buyUSD?.toFixed(2) || "-"}</td>
                    <td>{portfolio[etf]?.buyShares?.toFixed(2) || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTransactionAdded={() => {
          fetchTransactions();
          fetchPortfolio();
        }}
      />
    </div>
  );
}
