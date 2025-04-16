import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="bg-blue-600 p-4 text-white flex justify-between items-center">
      <h1 className="text-xl font-bold">Volt Cafe</h1>
      <div className="space-x-4">
        <Link to="/" className="hover:underline">Menu</Link> | 
        <Link to="/cart" className="hover:underline">Cart</Link> | 
        <Link to="/checkout" className="hover:underline">Checkout</Link> | 
        <Link to="/orders" className="hover:underline">Orders</Link>
      </div>
    </nav>
  );
};

export default Navbar;
