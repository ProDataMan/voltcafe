require('dotenv').config();
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const fs = require('fs').promises;
const app = express();

app.use(express.static('public'));

// Load from environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION;

let ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
let REFRESH_TOKEN = process.env.REFRESH_TOKEN || '';
let VEHICLE_ID = process.env.VEHICLE_ID || '';
let PARTNER_TOKEN = process.env.PARTNER_TOKEN || '';

const SUPERCHARGER = { lat: 47.6815, lon: -122.2087, name: 'Seattle 116th Ave NE' };

async function saveTokens(accessToken, refreshToken, partnerToken = null) {
  ACCESS_TOKEN = accessToken || ACCESS_TOKEN;
  REFRESH_TOKEN = refreshToken || REFRESH_TOKEN;
  if (partnerToken) PARTNER_TOKEN = partnerToken;
  const envContent = `
CLIENT_ID=${CLIENT_ID}
CLIENT_SECRET=${CLIENT_SECRET}
REDIRECT_URI=${REDIRECT_URI}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
AWS_REGION=${AWS_REGION}
ACCESS_TOKEN=${ACCESS_TOKEN}
REFRESH_TOKEN=${REFRESH_TOKEN}
VEHICLE_ID=${VEHICLE_ID}
PARTNER_TOKEN=${PARTNER_TOKEN}
  `.trim();
  await fs.writeFile('.env', envContent, 'utf8');
  console.log('Tokens saved to .env');
}

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
    await saveTokens(access_token, refresh_token);
    res.send(`Token received! Access Token: ${access_token}`);
  } catch (error) {
    console.error('Token Error:', error.response?.data || error.message);
    res.send('Error: ' + error.message);
  }
});

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

app.get('/get-partner-token', async (req, res) => {
  try {
    const response = await axios.post('https://auth.tesla.com/oauth2/v3/token', querystring.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'openid vehicle_device_data vehicle_cmds vehicle_charging_cmds',
      audience: 'https://fleet-api.prd.na.vn.cloud.tesla.com',
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const { access_token } = response.data;
    await saveTokens(null, null, access_token);
    console.log('Partner Token:', access_token);
    res.send(`Partner Token: ${access_token}`);
  } catch (error) {
    console.error('Partner Token Error:', error.response?.data || error.message);
    res.status(500).send('Error: ' + (error.response?.data?.error_description || error.message));
  }
});

app.get('/register', async (req, res) => {
  const PARTNER_TOKEN_LOCAL = PARTNER_TOKEN || 'your_partner_token_here';
  try {
    const response = await axios.post(
      'https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/partner_accounts',
      { domain: '54.123.45.67' }, // Replace with your EC2 public IP after deployment
      { headers: { Authorization: `Bearer ${PARTNER_TOKEN_LOCAL}`, 'Content-Type': 'application/json' } }
    );
    console.log('Registration Status:', response.status);
    console.log('Registration Response:', response.data);
    res.json({ status: response.status, data: response.data });
  } catch (error) {
    console.error('Registration Error Status:', error.response?.status);
    console.error('Registration Error Data:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Registration Failed',
      status: error.response?.status,
      message: error.response?.data?.error || error.message,
    });
  }
});

app.get('/.well-known/appspecific/com.tesla.3p.public-key.pem', async (req, res) => {
  try {
    const publicKey = await fs.readFile('public-key.pem', 'utf8');
    res.set('Content-Type', 'text/plain');
    res.send(publicKey);
  } catch (error) {
    console.error('Public Key Error:', error.message);
    res.status(500).send('Error serving public key');
  }
});

app.get('/vehicles', async (req, res) => {
  if (!ACCESS_TOKEN) return res.status(401).send('Error: No access token available');
  try {
    const response = await axios.get('https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/vehicles', {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      timeout: 10000,
    });
    const vehicles = response.data.response || [];
    if (!vehicles.length) return res.status(200).json({ message: 'No vehicles found' });
    VEHICLE_ID = vehicles[0].id || '';
    if (VEHICLE_ID) await saveTokens(ACCESS_TOKEN, REFRESH_TOKEN);
    res.json({ vehicles, selected_vehicle_id: VEHICLE_ID });
  } catch (error) {
    console.error('Vehicles Error Status:', error.response?.status);
    console.error('Vehicles Error Data:', error.response?.data || error.message);
    res.status(error.response?.status || 500).send(`Error: ${error.response?.data?.error || error.message}`);
  }
});

app.get('/vehicles-partner', async (req, res) => {
  if (!PARTNER_TOKEN) return res.status(401).send('Error: No partner token available');
  try {
    const response = await axios.get('https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/vehicles', {
      headers: { Authorization: `Bearer ${PARTNER_TOKEN}` },
      timeout: 10000,
    });
    const vehicles = response.data.response || [];
    if (!vehicles.length) return res.status(200).json({ message: 'No vehicles found' });
    res.json({ vehicles });
  } catch (error) {
    console.error('Vehicles-Partner Error Status:', error.response?.status);
    console.error('Vehicles-Partner Error Data:', error.response?.data || error.message);
    res.status(error.response?.status || 500).send(`Error: ${error.response?.data?.error || error.message}`);
  }
});

function isNearSupercharger(lat, lon) {
  const distance = Math.sqrt((lat - SUPERCHARGER.lat) ** 2 + (lon - SUPERCHARGER.lon) ** 2);
  return distance < 0.015;
}

app.get('/tesla-data', async (req, res) => {
  if (!ACCESS_TOKEN || !VEHICLE_ID) return res.status(401).send('Error: Missing token or vehicle ID');
  try {
    const response = await axios.get(`https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/vehicles/${VEHICLE_ID}/vehicle_data`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    const data = response.data.response;
    const nav = data.drive_state || {};
    const charge = data.charge_state || {};
    const lat = nav.latitude, lon = nav.longitude;
    const odometer = data.odometer || 0;
    const energyUsed = charge.charge_energy_added || 0;

    const nearSupercharger = lat && lon ? isNearSupercharger(lat, lon) : false;
    const efficiency = odometer && energyUsed ? (energyUsed * 1000 / odometer).toFixed(2) : 0;

    res.json({
      destination: nav.active_route_destination || 'No destination set',
      latitude: lat,
      longitude: lon,
      charging: charge.charging_state === 'Charging',
      timeToFull: charge.time_to_full_charge || 0,
      nearSupercharger: nearSupercharger,
      superchargerName: nearSupercharger ? SUPERCHARGER.name : null,
      odometer: odometer,
      efficiency: efficiency,
    });
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Tesla data' });
  }
});

app.get('/admin', async (req, res) => {
  if (!ACCESS_TOKEN) return res.status(401).send('Error: No access token');
  try {
    const vehiclesResponse = await axios.get('https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/vehicles', {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    const vehicles = vehiclesResponse.data.response || [];
    res.json({
      vehicles: vehicles.map(v => ({
        id: v.id,
        vin: v.vin,
        display_name: v.display_name,
      })),
      total: vehicles.length,
    });
  } catch (error) {
    console.error('Admin Error:', error.response?.data || error.message);
    res.status(500).send('Error fetching admin data');
  }
});

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

app.get('/vending/check', async (req, res) => {
  const teslaData = await fetchData('http://localhost:3000/tesla-data');
  if (teslaData.nearSupercharger) {
    res.json({
      message: `Near ${teslaData.superchargerName}. Order now?`,
      url: 'http://localhost:3000/vending/menu',
    });
  } else {
    res.json({ message: 'Not near a Supercharger yet' });
  }
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