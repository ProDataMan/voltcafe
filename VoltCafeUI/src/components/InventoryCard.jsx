import React from 'react';

export default function InventoryCard({ item }) {
  return (
    <div className="border rounded shadow p-4">
      <h2 className="text-xl font-bold">Machine #{item.machine_id}</h2>
      <p>Product ID: {item.product_id}</p>
      <p>Slot: {item.slot_number}</p>
      <p>Stock: {item.quantity}</p>
    </div>
  );
}
