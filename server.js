const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const app = express();

// Serve static files from 'public' folder (for index.html, styles.css, script.js)
app.use(express.static('public'));

// Tesla API Credentials (replace with your values)
const CLIENT_ID = 'f2745517-42da-44d3-ac89-be1e565d77fc';
const CLIENT_SECRET = 'ta-secret.1GeS^ewMTNMTm6-E';
const REDIRECT_URI = 'http://localhost:3000/callback';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InFEc3NoM2FTV0cyT05YTTdLMzFWV0VVRW5BNCJ9.eyJpc3MiOiJodHRwczovL2F1dGgudGVzbGEuY29tL29hdXRoMi92My9udHMiLCJhenAiOiJmMjc0NTUxNy00MmRhLTQ0ZDMtYWM4OS1iZTFlNTY1ZDc3ZmMiLCJzdWIiOiJlNzc3MDcwMy1iNDYyLTRjZTAtYjAwMy1hOTJiOTAxOWRiYTgiLCJhdWQiOlsiaHR0cHM6Ly9mbGVldC1hcGkucHJkLm5hLnZuLmNsb3VkLnRlc2xhLmNvbSIsImh0dHBzOi8vZmxlZXQtYXBpLnByZC5ldS52bi5jbG91ZC50ZXNsYS5jb20iLCJodHRwczovL2F1dGgudGVzbGEuY29tL29hdXRoMi92My91c2VyaW5mbyJdLCJzY3AiOlsidmVoaWNsZV9kZXZpY2VfZGF0YSIsIm9mZmxpbmVfYWNjZXNzIl0sImFtciI6WyJwd2QiLCJyZWxvZ2luIiwibWZhIiwib3RwIl0sImV4cCI6MTc0MjUzODc3NCwiaWF0IjoxNzQyNTA5OTc0LCJvdV9jb2RlIjoiTkEiLCJsb2NhbGUiOiJlbi1VUyIsImFjY291bnRfdHlwZSI6ImJ1c2luZXNzIiwib3Blbl9zb3VyY2UiOmZhbHNlLCJhY2NvdW50X2lkIjoiOTdjYjAyODktMzUwYi00NzliLTk0OTgtNzZkZjYwZTJiNmM5IiwiYXV0aF90aW1lIjoxNzQyNTA5OTczfQ.Q8G195FevcftG8qZFh_dSbmUBUK41GwluWtnk9ELfoGv_7sr8XAVQ_3ZqtLu3x_7uU-Ri3tYrCi1zrI0kYK-riQ7I0PRQ2I-7k2gkfjrcOqy_2j9Q3O64eHMZNfNB6U02tFVZUl8mpA6uaK6oqL7zZ4qcMGJ2QcvFKaaMNvVH5n6OjSYRHD6qYaTmxS3qr4BRkody_uNWpj3JzU7W5G-p33wlBiyOnZZOZFdAOk_lpSfwqI4s-c1nd0WF9w2cHGr1wWC2rdfiUKXDp7eF4AtnanlBQJrF9QEhmVfVX12P9gjANmw_sPz3mWiME8iKmpvvBRZ-qj7brDKpRtbEEDywA'; // From callback
const VEHICLE_ID = 'YOUR_VEHICLE_ID'; // From /vehicles

// Step 1: Redirect to Tesla login for user authorization
app.get('/login', (req, res) => {
  const authUrl = `https://auth.tesla.com/oauth2/v3/authorize?` +
    querystring.stringify({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: 'vehicle_device_data vehicle_cmds vehicle_charging_cmds offline_access',
      state: 'voltcafe'
    });
  console.log('Auth URL:', authUrl);
  res.redirect(authUrl);
});

// Step 2: Handle callback and exchange code for user token
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
    console.log('Access Token:', access_token);
    console.log('Refresh Token:', refresh_token);
    res.send(`Token received! Check console for details.`);
  } catch (error) {
    console.error('Token Error:', error.response?.data || error.message);
    res.send('Error: ' + error.message);
  }
});

// Generate Partner Token for app registration
app.get('/partner-token', async (req, res) => {
  try {
    const response = await axios.post('https://auth.tesla.com/oauth2/v3/token', {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'openid vehicle_device_data vehicle_cmds vehicle_charging_cmds',
      audience: 'https://fleet-api.prd.na.vn.cloud.tesla.com' // North America
    });
    const partnerToken = response.data.access_token;
    console.log('Partner Token:', partnerToken);
    res.send(`Partner Token: ${partnerToken}`);
  } catch (error) {
    console.error('Partner Token Error:', error.response?.data || error.message);
    res.send('Error: ' + error.message);
  }
});

// Register app in the region
app.get('/register-app', async (req, res) => {
  const partnerToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InFEc3NoM2FTV0cyT05YTTdLMzFWV0VVRW5BNCJ9.eyJndHkiOiJjbGllbnQtY3JlZGVudGlhbHMiLCJzdWIiOiI5N2NiMDI4OS0zNTBiLTQ3OWItOTQ5OC03NmRmNjBlMmI2YzkiLCJpc3MiOiJodHRwczovL2F1dGgudGVzbGEuY29tL29hdXRoMi92My9udHMiLCJhenAiOiJmMjc0NTUxNy00MmRhLTQ0ZDMtYWM4OS1iZTFlNTY1ZDc3ZmMiLCJhdWQiOlsiaHR0cHM6Ly9hdXRoLnRlc2xhLmNvbS9vYXV0aDIvdjMvY2xpZW50aW5mbyIsImh0dHBzOi8vZmxlZXQtYXBpLnByZC5uYS52bi5jbG91ZC50ZXNsYS5jb20iXSwiZXhwIjoxNzQyNTQwMzYwLCJpYXQiOjE3NDI1MTE1NjAsImFjY291bnRfdHlwZSI6ImJ1c2luZXNzIiwib3Blbl9zb3VyY2UiOmZhbHNlLCJzY3AiOlsidmVoaWNsZV9kZXZpY2VfZGF0YSIsIm9wZW5pZCJdfQ.Z-7c0eU_U_h7lDbIpu9Sykcz146NmQt1I0VaFtpjgSDgnHlEWwM52AkEGddVw36R4-qno38lHNdls1Ap6L6EpJW_4yqaxUOgFG_2J7eViWYfaJg06EBF7l_JTP4xLvR99GEoqh3Q5P67Ma4qsOKhzQ-YW4O0YNkD6eGvWxyyX3rHE98SmMHUjYMTvZd9Ckfs8tLx0DNE2ELmAZR7X8N1uaneoJAmtsuPOGz1QrkRxtOR5Xu9btBVSyyQapc-L-4bSuvrTrLu5nFrFzZHHkY_fvvDaAICPfXk2GZOOMYRzk3pWSjqWDWwNsA4ZlOG7hWpmiSgC7hoC0u7Ra2bjna-dA'; // Replace with token from /partner-token
  try {
    const response = await axios.post(
      'https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/partner_accounts',
      { domain: 'localhost' }, // Temporary for testing
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${partnerToken}`
        }
      }
    );
    console.log('Registration Response:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Registration Error:', error.response?.data || error.message);
    res.send('Error: ' + error.message);
  }
});

// Get list of vehicles
app.get('/vehicles', async (req, res) => {
  try {
    const response = await axios.get('https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/vehicles', {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log(response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Vehicles Error:', error.response?.data || error.message);
    res.send('Error: ' + error.message);
  }
});

// Tesla data with navigation and charging info
app.get('/tesla-data', async (req, res) => {
  try {
    const response = await axios.get(`https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/vehicles/${VEHICLE_ID}/vehicle_data`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
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

// Mock transit arrival (replace with real API later)
app.get('/transit-arrival', (req, res) => {
  res.json({ station: 'Downtown', arrivalTime: '15 minutes' });
});

// Vending machine mock API
let orders = [];
app.get('/vending/menu', (req, res) => {
  res.json([
    { id: 1, item: 'Pizza', price: 5.00 },
    { id: 2, item: 'Soda', price: 2.00 }
  ]);
});

app.post('/vending/order', async (req, res) => {
  const teslaData = await fetchData('http://localhost:3000/tesla-data');
  const order = {
    id: orders.length + 1,
    item: req.query.item,
    status: 'Pending',
    charging: teslaData.charging,
    timeToFull: teslaData.timeToFull
  };
  orders.push(order);
  if (order.charging) {
    console.log(`Vending notified: Prepare order #${order.id} (${order.item}), ready in ${order.timeToFull} hours`);
  }
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

// Helper function for server-side fetch
async function fetchData(url) {
  const response = await axios.get(url);
  return response.data;
}

// Start server
app.listen(3000, () => console.log('Server on port 3000'));