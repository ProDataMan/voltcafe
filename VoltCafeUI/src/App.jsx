// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Menu from './pages/Menu';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import { CartProvider } from './context/CartContext';
import ManageInventory from './pages/ManageInventory';
import ManageMachines from './pages/ManageMachines';
// ...

function App() {
  return (
    <CartProvider>
      <Router>
        <div className="min-h-screen bg-gray-100 text-gray-900">
          <Navbar />
          <Routes>
            <Route path="/" element={<Menu />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/manage-inventory" element={<ManageInventory />} />
            <Route path="/manage-machines" element={<ManageMachines />} />
          </Routes>
        </div>
      </Router>
    </CartProvider>
  );
}

export default App;
