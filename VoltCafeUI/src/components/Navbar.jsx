import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
<nav className="bg-blue-700 shadow-md p-4 text-white flex justify-between items-center">
  <h1 className="text-2xl font-bold tracking-wide">⚡ Volt Cafe</h1>
  <div className="flex space-x-4">
    <Link to="/" className="hover:text-yellow-300 transition">Menu</Link>
    <Link to="/cart" className="hover:text-yellow-300 transition">Cart</Link>
    <Link to="/checkout" className="hover:text-yellow-300 transition">Checkout</Link>
    <Link to="/orders" className="hover:text-yellow-300 transition">Orders</Link>
    <Link to="/manage-inventory" className="hover:text-yellow-300 transition">Inventory</Link>
    <Link to="/manage-machines" className="hover:text-yellow-300 transition">Machines</Link>
  </div>
</nav>
  );
};

export default Navbar;
