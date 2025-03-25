async function fetchData(url) {
    const response = await fetch(url);
    return response.json();
  }
  
  async function updateStatus() {
    const teslaStatus = document.getElementById('tesla-status');
    const transitStatus = document.getElementById('transit-status');
  
    // Tesla data
    try {
      const teslaData = await fetchData('http://localhost:3000/tesla-data');
      teslaStatus.innerText = `Destination: ${teslaData.destination}`;
    } catch (error) {
      teslaStatus.innerText = 'Error fetching Tesla data';
    }
  
    // Transit data (mock for now)
    const transitData = await fetchData('http://localhost:3000/transit-arrival');
    transitStatus.innerText = `Arrival: ${transitData.arrivalTime}`;
  }
  
  async function loadMenu() {
    const menuDiv = document.getElementById('menu');
    const menu = await fetchData('http://localhost:3000/vending/menu');
    menu.forEach(item => {
      const btn = document.createElement('button');
      btn.innerText = `${item.item} - $${item.price}`;
      btn.onclick = () => placeOrder(item.item);
      menuDiv.appendChild(btn);
    });
  }
  
  async function placeOrder(item) {
    const orderStatus = document.getElementById('order-status');
    const order = await fetchData(`http://localhost:3000/vending/order?item=${item}`);
    orderStatus.innerText = `Order #${order.id} placed for ${item}!`;
  }
  
  // Load app
  updateStatus();
  loadMenu();
  setInterval(updateStatus, 30000); // Update every 30 seconds