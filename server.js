require('dotenv').config();
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const fs = require('fs').promises;
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL pool using env config
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'volt_cafe',
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});


app.use(cors({
  origin: `http://${process.env.POSTGRES_HOST}`,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Standard inventory API routes

// Get all inventory
app.get('/vending/inventory', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        inventory.id,
        inventory.quantity,
        inventory.slot_number,
        inventory.machine_id,
        inventory.product_id,
        products.name AS product_name,
        products.description,
        products.price,
        machines.name AS machine_name
      FROM inventory
      JOIN products ON inventory.product_id = products.id
      JOIN machines ON inventory.machine_id = machines.id
      ORDER BY inventory.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching enriched inventory:', err);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Add new inventory item
app.post('/vending/inventory', async (req, res) => {
  const { name, description, price, quantity, machine_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO inventory (name, description, price, quantity, machine_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description, price, quantity, machine_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding inventory:', err);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Update inventory item
app.put('/vending/inventory/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, price, quantity } = req.body;
  try {
    const result = await pool.query(
      'UPDATE inventory SET name = $1, description = $2, price = $3, quantity = $4 WHERE id = $5 RETURNING *',
      [name, description, price, quantity, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating inventory:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete inventory item
app.delete('/vending/inventory/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM inventory WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted', item: result.rows[0] });
  } catch (err) {
    console.error('Error deleting inventory:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Purchase endpoint - deduct quantity and log transaction
app.post('/vending/order', async (req, res) => {
  const { inventory_id, quantity } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const itemResult = await client.query('SELECT * FROM inventory WHERE id = $1 FOR UPDATE', [inventory_id]);
    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemResult.rows[0];
    if (item.quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not enough stock' });
    }

    await client.query('UPDATE inventory SET quantity = quantity - $1 WHERE id = $2', [quantity, inventory_id]);
    const logResult = await client.query(
      'INSERT INTO vending_log (inventory_id, quantity, status) VALUES ($1, $2, $3) RETURNING *',
      [inventory_id, quantity, 'vend_initiated']
    );

    await client.query('COMMIT');
    res.json({ message: 'Order placed', log: logResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error processing order:', err);
    res.status(500).json({ error: 'Order failed' });
  } finally {
    client.release();
  }
});

// Get all machines
app.get('/vending/machines', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machines ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching machines:', err);
    res.status(500).json({ error: 'Failed to fetch machines' });
  }
});

// Create a new machine
app.post('/vending/machines', async (req, res) => {
  const { name, type, location, mdb_address } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO machines (name, type, location, mdb_address)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, type, location, mdb_address]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating machine:', err);
    res.status(500).json({ error: 'Failed to create machine' });
  }
});

// Update a machine
app.put('/vending/machines/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, location, mdb_address, active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE machines
       SET name = $1, type = $2, location = $3, mdb_address = $4, active = $5
       WHERE id = $6 RETURNING *`,
      [name, type, location, mdb_address, active, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Machine not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating machine:', err);
    res.status(500).json({ error: 'Failed to update machine' });
  }
});

// Delete a machine
app.delete('/vending/machines/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM machines WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Machine not found' });
    res.json({ message: 'Machine deleted', machine: result.rows[0] });
  } catch (err) {
    console.error('Error deleting machine:', err);
    res.status(500).json({ error: 'Failed to delete machine' });
  }
});

// Health check
app.get('/health', (req, res) => res.send('Volt Cafe API is up!'));

app.listen(3000, () => console.log('Server running on port 3000'));