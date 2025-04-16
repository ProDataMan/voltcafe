import React, { useEffect, useState } from 'react';
import { fetchInventory } from '../api';
import InventoryCard from '../components/InventoryCard';

export default function Inventory() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetchInventory().then(setItems);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-center mb-4">Inventory</h1>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {items.map(item => (
          <InventoryCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
