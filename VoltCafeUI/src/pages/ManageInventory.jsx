import React, { useEffect, useState } from 'react';

import { API_BASE } from "../config";

const ManageInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    quantity: '',
    machine_id: '',
  });

  const fetchInventory = async () => {
    try {
      const res = await fetch(`${API_BASE}/vending/inventory`);
      const data = await res.json();
      setInventory(data);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem
      ? `${API_BASE}/vending/inventory/${editingItem.id}`
      : `${API_BASE}/vending/inventory`;

    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      quantity: parseInt(form.quantity, 10),
      machine_id: parseInt(form.machine_id, 10),
    };

    try {
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setForm({
        name: '',
        description: '',
        price: '',
        quantity: '',
        machine_id: '',
      });
      setEditingItem(null);
      fetchInventory();
    } catch (err) {
      console.error('Error saving item:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await fetch(`${API_BASE}/vending/inventory/${id}`, { method: 'DELETE' });
      fetchInventory();
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name || '',
      description: item.description || '',
      price: item.price || '',
      quantity: item.quantity || '',
      machine_id: item.machine_id || '',
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">Admin Inventory Manager</h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mx-auto mb-10">
        <input
          type="text"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          className="w-full border px-4 py-2 rounded"
        />
        <input
          type="text"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full border px-4 py-2 rounded"
        />
        <input
          type="number"
          placeholder="Price"
          step="0.01"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          required
          className="w-full border px-4 py-2 rounded"
        />
        <input
          type="number"
          placeholder="Quantity"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          required
          className="w-full border px-4 py-2 rounded"
        />
        <input
          type="number"
          placeholder="Machine ID"
          value={form.machine_id}
          onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
          required
          className="w-full border px-4 py-2 rounded"
        />
        <button
          type="submit"
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 w-full"
        >
          {editingItem ? 'Update Item' : 'Add Item'}
        </button>
      </form>

      {/* Inventory List */}
      <h2 className="text-2xl font-semibold mb-4">Inventory</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {inventory.map((item) => (
          <div key={item.id} className="border p-4 rounded shadow-sm bg-white">
            <p><strong>Name:</strong> {item.name || '(n/a)'}</p>
            <p><strong>Description:</strong> {item.description || '(n/a)'}</p>
            <p><strong>Price:</strong> ${item.price || '?'}</p>
            <p><strong>Quantity:</strong> {item.quantity}</p>
            <p><strong>Machine ID:</strong> {item.machine_id}</p>
            <div className="flex gap-2 mt-3">
              <button
                className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600"
                onClick={() => handleEdit(item)}
              >
                Edit
              </button>
              <button
                className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600"
                onClick={() => handleDelete(item.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManageInventory;
