import React, { useContext, useState } from 'react';
import { CartContext } from '../context/CartContext';

const API_BASE = import.meta.env.VITE_API_HOST || 'http://localhost:3000';

const Cart = () => {
  const { cartItems, removeFromCart, clearCart } = useContext(CartContext);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      for (const item of cartItems) {
        const res = await fetch(`${API_BASE}/vending/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inventory_id: item.id,
            quantity: 1, // assuming 1 per click for now
          }),
        });

        const result = await res.json();

        if (!res.ok) throw new Error(result.error || 'Failed to place order');
      }

      setMessage('Order placed successfully!');
      clearCart();
    } catch (err) {
      console.error('Checkout error:', err.message);
      setMessage('Error placing order: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Cart</h1>

      {message && <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800">{message}</div>}

      {cartItems.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          <ul className="mb-4 space-y-3">
            {cartItems.map((item) => (
              <li key={item.id} className="border p-4 rounded shadow">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold">Product #{item.product_id}</h2>
                    <p>Machine: {item.machine_id} | Slot: {item.slot_number}</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button
            onClick={handleCheckout}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Checkout'}
          </button>
        </>
      )}
    </div>
  );
};

export default Cart;
