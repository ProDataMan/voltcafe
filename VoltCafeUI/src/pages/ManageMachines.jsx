import React, { useEffect, useState } from 'react';

import { API_BASE } from "../config";

const ManageMachines = () => {
  const [machines, setMachines] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    type: '',
    location: '',
    mdb_address: '',
    active: true
  });

  const fetchMachines = async () => {
    try {
      const res = await fetch(`${API_BASE}/vending/machines`);
      const data = await res.json();
      setMachines(data);
    } catch (err) {
      console.error('Failed to fetch machines:', err);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = formData.id ? 'PUT' : 'POST';
      const url = formData.id
        ? `${API_BASE}/vending/machines/${formData.id}`
        : `${API_BASE}/vending/machines`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setFormData({ id: null, name: '', type: '', location: '', mdb_address: '', active: true });
        fetchMachines();
      } else {
        const err = await res.json();
        console.error('Failed to save machine:', err);
      }
    } catch (err) {
      console.error('Error saving machine:', err);
    }
  };

  const handleEdit = (machine) => {
    setFormData(machine);
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${API_BASE}/vending/machines/${id}`, { method: 'DELETE' });
      fetchMachines();
    } catch (err) {
      console.error('Error deleting machine:', err);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Machines</h1>

      <form onSubmit={handleSubmit} className="mb-6 space-y-4 max-w-md">
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Machine Name"
          className="w-full border p-2"
          required
        />
        <input
          type="text"
          name="type"
          value={formData.type}
          onChange={handleChange}
          placeholder="Type (e.g., drink, snack)"
          className="w-full border p-2"
          required
        />
        <input
          type="text"
          name="location"
          value={formData.location}
          onChange={handleChange}
          placeholder="Location"
          className="w-full border p-2"
        />
        <input
          type="text"
          name="mdb_address"
          value={formData.mdb_address}
          onChange={handleChange}
          placeholder="MDB Address"
          className="w-full border p-2"
        />
        <label className="inline-flex items-center space-x-2">
          <input
            type="checkbox"
            name="active"
            checked={formData.active}
            onChange={handleChange}
          />
          <span>Active</span>
        </label>
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          {formData.id ? 'Update Machine' : 'Add Machine'}
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {machines.map((machine) => (
          <div key={machine.id} className="border p-4 rounded shadow">
            <h2 className="text-lg font-semibold">{machine.name}</h2>
            <p>Type: {machine.type}</p>
            <p>Location: {machine.location}</p>
            <p>MDB: {machine.mdb_address}</p>
            <p>Status: {machine.active ? 'Active' : 'Inactive'}</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleEdit(machine)}
                className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(machine.id)}
                className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
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

export default ManageMachines;
