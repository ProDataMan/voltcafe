import React, { useEffect, useState, useContext } from 'react';
import { CartContext } from '../context/CartContext';

const API_BASE = import.meta.env.VITE_API_HOST || 'http://localhost:3000';

const Menu = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useContext(CartContext);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const res = await fetch(`${API_BASE}/vending/inventory`);
        const data = await res.json();
        setInventory(data);
      } catch (err) {
        console.error('Failed to fetch inventory:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Menu</h1>

      {loading ? (
        <p>Loading inventory...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {inventory.map((item) => (
            <div key={item.id} className="border p-4 rounded shadow">
              <h2 className="text-lg font-semibold">Product ID #{item.product_id}</h2>
              <p>Machine ID: {item.machine_id}</p>
              <p>Slot #: {item.slot_number}</p>
              <p>Quantity: {item.quantity}</p>
              <button
                onClick={() => addToCart(item)}
                className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Menu;
