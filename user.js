document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    // Page Routing Logic
    if (path.includes('home.html')) {
        checkAuth('user').then(() => {
            loadCrops();
            loadUserOrders();
        });
    } else if (path.includes('crop.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const cropId = urlParams.get('id');
        if (cropId) {
            checkAuth('user').then(() => {
                loadCropDetails(cropId);
            });
        } else {
            window.location.href = 'home.html';
        }
    }
});

// 1. Load Crops (Filters: Qty > 0 and Deadline > Now)
async function loadCrops() {
    const now = new Date().toISOString();
    
    const { data: crops, error } = await _supabase
        .from('crops')
        .select('*')
        .gt('quantity', 0)
        .gt('freshness_deadline', now);

    const container = document.getElementById('crop-list');
    if (!container) return;
    container.innerHTML = '';

    if (error) {
        container.innerHTML = '<p>Error loading crops.</p>';
        return;
    }

    if (!crops || crops.length === 0) {
        container.innerHTML = '<p>No fresh crops available right now.</p>';
        return;
    }

    crops.forEach((crop, index) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <img src="${crop.image_url}" class="crop-img">
            <h3>${crop.name}</h3>
            <span class="status ${crop.status}">${crop.status.replace('_', ' ')}</span>
            <p>Price: ₹${crop.price} / ${crop.unit}</p>
            <p><small>Qty left: ${crop.quantity} ${crop.unit}</small></p>
            <button onclick="window.location.href='crop.html?id=${crop.id}'">View & Buy</button>
        `;
        container.appendChild(div);
    });
}

// 2. Load Crop Details (The fix for access issues)
async function loadCropDetails(id) {
    const { data: crop, error } = await _supabase
        .from('crops')
        .select('*')
        .eq('id', id)
        .single();
    
    const div = document.getElementById('crop-details');
    if (!div) return;

    if (error || !crop) {
        div.innerHTML = `<p>Crop not found.</p><button onclick="location.href='home.html'">Back</button>`;
        return;
    }

    const deadline = new Date(crop.freshness_deadline);
    
    div.innerHTML = `
        <img src="${crop.image_url}" class="crop-img">
        <h2>${crop.name}</h2>
        <p><strong>Available:</strong> ${crop.quantity} ${crop.unit}</p>
        <p><strong>Price:</strong> ₹${crop.price} / ${crop.unit}</p>
        <p style="color: red; margin-bottom: 30px;"><strong>Fresh until:</strong> ${deadline.toLocaleDateString()}</p>
        <hr>
        <label style="margin-top: 20px;">Quantity:</label>
        <input type="number" id="order-qty" max="${crop.quantity}" min="1" value="1" oninput="updateTotal(${crop.price})">
        <label>Address:</label>
        <input type="text" id="order-addr" value="${userProfile ? userProfile.address : ''}">
        <h3>Total: ₹<span id="total-price">${crop.price}</span></h3>
        <button onclick="placeOrder(${crop.id}, ${crop.price}, ${crop.quantity})">Pay & Order</button>
    `;
}

// 3. Helper for Price Calculation
function updateTotal(price) {
    const qty = document.getElementById('order-qty').value;
    document.getElementById('total-price').innerText = qty * price;
}

// 4. Place Order Logic
async function placeOrder(cropId, price, availableQty) {
    const qty = parseInt(document.getElementById('order-qty').value);
    const address = document.getElementById('order-addr').value;

    if (qty > availableQty) return alert("Not enough stock!");
    if (!confirm(`Confirm order for ₹${qty * price}?`)) return;

    const { error: orderError } = await _supabase.from('orders').insert([{
        user_id: currentUser.id,
        crop_id: cropId,
        quantity: qty,
        total_price: qty * price,
        address: address,
        status: 'placed'
    }]);

    if (orderError) return alert(orderError.message);

    // Update Stock
    await _supabase.from('crops').update({ quantity: availableQty - qty }).eq('id', cropId);
    
    alert("Order Placed Successfully!");
    window.location.href = 'home.html';
}

// 5. Order History Fix
async function loadUserOrders() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) return;

    const { data: orders, error } = await _supabase
        .from('orders')
        .select(`id, quantity, total_price, status, created_at, crops ( name )`)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

    const list = document.getElementById('user-order-history');
    if (!list) return;
    list.innerHTML = '';

    if (error || orders.length === 0) {
        list.innerHTML = '<p>No orders yet.</p>';
        return;
    }

    orders.forEach(o => {
        const d = document.createElement('div');
        d.className = 'card';
        d.innerHTML = `
            <strong>${o.crops ? o.crops.name : 'Crop'}</strong><br>
            Qty: ${o.quantity} | ₹${o.total_price}<br>
            Status: <span class="status">${o.status.toUpperCase()}</span>
        `;
        list.appendChild(d);
    });
}