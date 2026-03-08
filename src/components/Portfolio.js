import React, { useEffect, useState } from "react";
import { supabase } from "../databaseClient/supabaseClient";
import axios from "axios";

const TARGETS = { VOO: 0.5, VXUS: 0.3, SCHD: 0.15, GLDM: 0.05 };
const MONTHLY_APORTE = 2000;

export default function Portfolio() {
  const [prices, setPrices] = useState({});
  const [shares, setShares] = useState({ VOO: 0, VXUS: 0, SCHD: 0, GLDM: 0 });
  const [portfolio, setPortfolio] = useState({});
  const fetchShares = async () => {
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/portfolio`,
      );
      if (res.data.success) {
        const sharesFromDb = {};
        res.data.data.forEach((row) => {
          sharesFromDb[row.etf] = Number(row.shares);
        });
        setShares(sharesFromDb);
      } else {
        console.error("Failed to fetch shares:", res.data.message);
      }
    } catch (err) {
      console.error("Error fetching shares:", err);
    }
  };

  useEffect(() => fetchShares(), []);
  useEffect(() => fetchPrices(), []);

  const saveShare = async (etf, sharesValue) => {
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/portfolio`,
        {
          etf,
          shares: sharesValue,
        },
      );
      if (!res.data.success) {
        console.error("Failed to save share:", res.data.message);
      }
    } catch (err) {
      console.error("Error saving share:", err);
    }
  };

  const fetchPrices = async () => {
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/prices`,
      );
      if (res.data.success) setPrices(res.data.prices);
    } catch (err) {
      console.error(err);
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

  return (
    <div>
      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>ETF</th>
            <th>Price</th>
            <th>Shares</th>
            <th>Value</th>
            <th>Weight</th>
            <th>Gap</th>
            <th>Buy $</th>
            <th>Buy Shares</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(TARGETS).map((etf) => (
            <tr key={etf}>
              <td>{etf}</td>
              <td>{portfolio[etf]?.price?.toFixed(2) || "-"}</td>
              <td>
                <input
                  type="number"
                  value={shares[etf]}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setShares({ ...shares, [etf]: val });
                  }}
                  onBlur={(e) => {
                    const val = Number(e.target.value);
                    saveShare(etf, val);
                  }}
                />
              </td>
              <td>{portfolio[etf]?.value?.toFixed(2) || "-"}</td>
              <td>{((portfolio[etf]?.weight || 0) * 100).toFixed(2)}%</td>
              <td>{((portfolio[etf]?.gap || 0) * 100).toFixed(2)}%</td>
              <td>{portfolio[etf]?.buyUSD?.toFixed(2) || "-"}</td>
              <td>{portfolio[etf]?.buyShares?.toFixed(2) || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={fetchPrices} style={{ marginTop: "1rem" }}>
        Refresh Prices
      </button>
    </div>
  );
}
