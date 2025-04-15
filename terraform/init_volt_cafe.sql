
-- Create schema for Volt Cafe

CREATE TABLE IF NOT EXISTS machines (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('drink', 'snack', 'combo', 'hotfood')),
    location TEXT,
    mdb_address TEXT,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(6, 2) NOT NULL,
    image_url TEXT,
    is_hot BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    machine_id INT REFERENCES machines(id),
    product_id INT REFERENCES products(id),
    slot_number INT,
    quantity INT DEFAULT 0,
    UNIQUE(machine_id, slot_number)
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    status TEXT CHECK (status IN ('pending', 'paid', 'failed', 'dispensed')) DEFAULT 'pending',
    total NUMERIC(6, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    machine_id INT REFERENCES machines(id),
    quantity INT,
    unit_price NUMERIC(6, 2)
);

-- Sample Data
INSERT INTO machines (name, type, location) VALUES 
  ('Drink Machine 01', 'drink', 'Container A'),
  ('Snack Machine 01', 'snack', 'Container A')
  ON CONFLICT DO NOTHING;

INSERT INTO products (name, description, price) VALUES 
  ('Cola', 'Chilled 12oz Cola', 1.50),
  ('Chips', 'Crunchy salted chips', 2.00)
  ON CONFLICT DO NOTHING;

INSERT INTO inventory (machine_id, product_id, slot_number, quantity) VALUES 
  (1, 1, 10, 20),
  (2, 2, 5, 15)
  ON CONFLICT DO NOTHING;
