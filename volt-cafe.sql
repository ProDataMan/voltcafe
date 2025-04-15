-- Create database
CREATE DATABASE volt_cafe;

\c volt_cafe;

-- Machines table
CREATE TABLE machines (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('drink', 'snack', 'combo', 'hotfood')),
    location TEXT,
    mdb_address TEXT, -- for future API integration
    active BOOLEAN DEFAULT TRUE
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(6, 2) NOT NULL,
    image_url TEXT,
    is_hot BOOLEAN DEFAULT FALSE
);

-- Inventory table (tracks items stocked in machines)
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    machine_id INT REFERENCES machines(id),
    product_id INT REFERENCES products(id),
    slot_number INT,
    quantity INT DEFAULT 0,
    UNIQUE(machine_id, slot_number)
);

-- Orders table (1 per transaction)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    status TEXT CHECK (status IN ('pending', 'paid', 'failed', 'dispensed')) DEFAULT 'pending',
    total NUMERIC(6, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items (line items for each order)
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    machine_id INT REFERENCES machines(id),
    quantity INT,
    unit_price NUMERIC(6, 2)
);

-- Vend Log (optional - track vending events)
CREATE TABLE vend_log (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    machine_id INT REFERENCES machines(id),
    slot_number INT,
    status TEXT CHECK (status IN ('success', 'failed')),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
