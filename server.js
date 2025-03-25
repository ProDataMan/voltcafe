require('dotenv').config();
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const fs = require('fs').promises; // For file writing
const app = express();

app.use(express.static('public'));

// Load from environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
let ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
let REFRESH_TOKEN = process.env.REFRESH_TOKEN || '';
let VEHICLE_ID = process.env.VEHICLE_ID || '';

// Save tokens to .env file
async function saveTokens(accessToken, refreshToken) {
  ACCESS_TOKEN = accessToken;
  REFRESH_TOKEN = refreshToken;
  const envContent = `
CLIENT_ID=${CLIENT_ID}
CLIENT_SECRET=${CLIENT_SECRET}
REDIRECT_URI=${REDIRECT_URI}
ACCESS_TOKEN=${accessToken}
REFRESH_TOKEN=${refreshToken}
VEHICLE_ID=${VEHICLE_ID}
  `.trim();
  await fs.writeFile('.env', envContent, 'utf8');
  console.log('Tokens saved to .env');
}

// Tesla login
app.get('/login', (req, res) => {
  const authUrl = `https://auth.tesla.com/oauth2/v3/authorize?` +
    querystring.stringify({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: 'vehicle_device_data vehicle_cmds vehicle_charging_cmds offline_access',
      state: 'voltcafe'
    });
  res.redirect(authUrl);
});

// Handle callback and store tokens
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.send('Error: No code received');

  try {
    const tokenResponse = await axios.post('https://auth.tesla.com/oauth2/v3/token', {
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      redirect_uri: REDIRECT_URI
    });
    const { access_token, refresh_token } = tokenResponse.data;
    await saveTokens(access_token, refresh_token); // Save dynamically
    res.send(`Token received! Access Token: ${access_token}`);
  } catch (error) {
    console.error('Token Error:', error.response?.data || error.message);
    res.send('Error: ' + error.message);
  }
});

// Refresh token when expired
app.get('/refresh', async (req, res) => {
  try {
    const response = await axios.post('https://auth.tesla.com/oauth2/v3/token', {
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN
    });
    const { access_token, refresh_token } = response.data;
    await saveTokens(access_token, refresh_token);
    res.send(`Token refreshed! New Access Token: ${access_token}`);
  } catch (error) {
    console.error('Refresh Error:', error.response?.data || error.message);
    res.send('Error: ' + error.message);
  }
});

// Get vehicles
app.get('/vehicles', async (req, res) => {
  if (!ACCESS_TOKEN) return res.send('Error: No access token available');
  try {
    const response = await axios.get('https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/vehicles', {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    VEHICLE_ID = response.data.response[0]?.id || ''; // Auto-set first vehicle
    if (VEHICLE_ID) await saveTokens(ACCESS_TOKEN, REFRESH_TOKEN); // Update .env with vehicle_id
    res.json(response.data);
  } catch (error) {
    console.error('Vehicles Error:', error.response?.data || error.message);
    res.send('Error: ' + error.message);
  }
});

// Tesla data
app.get('/tesla-data', async (req, res) => {
  if (!ACCESS_TOKEN || !VEHICLE_ID) return res.send('Error: Missing token or vehicle ID');
  try {
    const response = await axios.get(`https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/vehicles/${VEHICLE_ID}/vehicle_data`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    const data = response.data.response;
    const nav = data.navigation || {};
    const charge = data.charge_state || {};
    res.json({
      destination: nav.destination || 'No destination set',
      charging: charge.charging_state === 'Charging',
      timeToFull: charge.time_to_full_charge || 0
    });
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    res.json({ destination: 'Mock Charger', charging: false, timeToFull: 0 });
  }
});

// Mock transit and vending routes (unchanged for now)
app.get('/transit-arrival', (req, res) => {
  res.json({ station: 'Downtown', arrivalTime: '15 minutes' });
});

let orders = [];
app.get('/vending/menu', (req, res) => {
  res.json([
    { id: 1, item: 'Pizza', price: 5.00 },
    { id: 2, item: 'Soda', price: 2.00 }
  ]);
});

app.post('/vending/order', async (req, res) => {
  const teslaData = await fetchData('http://localhost:3000/tesla-data');
  const order = { id: orders.length + 1, item: req.query.item, status: 'Pending', charging: teslaData.charging, timeToFull: teslaData.timeToFull };
  orders.push(order);
  if (order.charging) console.log(`Vending notified: Prepare order #${order.id} (${order.item}), ready in ${order.timeToFull} hours`);
  res.json(order);
});

app.post('/vending/pay', (req, res) => {
  const orderId = req.query.orderId;
  const order = orders.find(o => o.id == orderId);
  if (order) {
    order.status = 'Paid';
    res.json({ success: true, message: `Order #${orderId} paid` });
  } else {
    res.json({ success: false, message: 'Order not found' });
  }
});

async function fetchData(url) {
  const response = await axios.get(url);
  return response.data;
}

app.listen(3000, () => console.log('Server on port 3000'));