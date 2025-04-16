const API_URL = import.meta.env.VITE_API_URL;

export const fetchInventory = async () => {
  const res = await fetch(`${API_URL}/vending/inventory`);
  return res.json();
};

export const addItem = async (item) => {
  const res = await fetch(`${API_URL}/vending/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  return res.json();
};

export const deleteItem = async (id) => {
  const res = await fetch(`${API_URL}/vending/inventory/${id}`, {
    method: 'DELETE'
  });
  return res.json();
};
