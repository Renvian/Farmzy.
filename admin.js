const GEMINI_API_KEY = "";

document.addEventListener('DOMContentLoaded', () => {
    checkAuth('admin');
    loadAdminOrders();
});

// Helper function to animate cards with staggered delays
function animateCards(container, delay = 100) {
    if (!container) return;
    const cards = container.querySelectorAll('.card');
    cards.forEach((card, index) => {
        setTimeout(() => {
            card.classList.add('card-animated');
        }, index * delay);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Inject the Base64 Logo
    const logoImg = document.getElementById('main-logo');
    if (logoImg && typeof FARMZY_LOGO_BASE64 !== 'undefined') {
        logoImg.src = FARMZY_LOGO_BASE64;
    }

    checkAuth('admin');
    loadAdminOrders();
});
// Helper for Gemini
async function callGemini(prompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// ACTION 1: PRE-HARVEST LOGIC
async function sendPreHarvestAlert() {
    const crop = document.getElementById('pre-crop-name').value;
    const qty = document.getElementById('pre-qty').value;
    const date = document.getElementById('pre-date').value;

    if (!qty || !date) return alert("Please fill expected quantity and date.");

    const prompt = `Write a short teaser notification: ${qty} of ${crop} will be harvested on ${new Date(date).toLocaleDateString()}. Make it sound fresh and exciting... 
   Generate a short, attractive PRE-HARVEST in-app notification for a farmer-to-consumer produce app.

STRICT RULES:
- Mention the crop name FIRST
- Capitalize the crop name
- Add a relevant farm/food emoji immediately after the crop name
- Keep the tone exciting and anticipatory
- Make the message friendly and mobile-optimized
- Display the harvest date in DD/MM/YYYY format
- Highlight the date using symbols or emojis
- Do NOT include explanations, titles, or extra text

FORMAT (DO NOT CHANGE):

<CROP NAME> <EMOJI> — <pre-harvest message>

📅 Harvest Date: 🔶 DD/MM/YYYY 🔶

MESSAGE GUIDELINES:
- Indicate the crop will be available soon
- Encourage users to get ready to order
- Emphasize freshness and local farming

EXAMPLES (FOLLOW THIS STYLE):

GUAVA 🍈 — Fresh harvest arriving soon! Get ready for naturally grown goodness 🌱
📅 Harvest Date: 🔶 18/01/2026 🔶

BANANA 🍌 — Locally grown bananas will be ready soon. Stay tuned for farm-fresh taste 🚜
📅 Harvest Date: 🔶 22/01/2026 🔶

Now generate the PRE-HARVEST notification using the provided crop name and harvest date.`

    
    try {
        const aiMessage = await callGemini(prompt);
        if (confirm(`Send Pre-Harvest Alert?\n\n"${aiMessage}"`)) {
            await _supabase.from('notifications').insert([{ message: aiMessage, crop_name: crop }]);
            await _supabase.from('crops').update({ status: 'coming_soon' }).eq('name', crop);
            alert("Pre-harvest notification sent!");
        }
    } catch (e) {
        alert("AI Error: " + e.message);
    }
}

// ACTION 2: INVENTORY UPDATE & ARRIVAL NOTIFY
async function updateInventoryAndNotify() {
    const name = document.getElementById('update-crop-name').value;
    const qty = parseInt(document.getElementById('update-qty').value);
    const unit = document.getElementById('update-unit').value;
    const price = parseInt(document.getElementById('update-price').value);
    const deadline = document.getElementById('update-deadline').value;

    if (!qty || !price || !deadline) return alert("Fill all fields to update inventory.");

    if (confirm(`Mark ${name} as available? This will notify users it has arrived.`)) {
        const status = qty > 0 ? 'available' : 'out_of_stock';
        const { error } = await _supabase.from('crops').update({
            quantity: qty, unit, price, freshness_deadline: deadline, status
        }).eq('name', name);

        if (error) return alert(error.message);

        try {
            const prompt = `Write an urgent notification for ${name}... (STRICT RULES followed)
            Generate a short, attractive POST-HARVEST in-app notification for a farmer-to-consumer produce app.

STRICT RULES:
- Mention the crop name FIRST
- Capitalize the crop name
- Add a relevant farm/food emoji immediately after the crop name
- Keep the tone urgent and action-oriented
- Make the message friendly and mobile-optimized
- Display the harvest date in DD/MM/YYYY format
- Highlight the date using symbols or emojis
- Do NOT include explanations, titles, or extra text

FORMAT (DO NOT CHANGE):

<CROP NAME> <EMOJI> — <post-harvest message>

📅 Harvest Date: 🔶 DD/MM/YYYY 🔶

MESSAGE GUIDELINES:
- Indicate the crop is available NOW
- Encourage immediate purchase
- Emphasize freshness and limited availability

EXAMPLES (FOLLOW THIS STYLE):

PAPAYA 🍍 — Freshly harvested and available now! Order before freshness ends 🛒
📅 Harvest Date: 🔶 25/01/2026 🔶

JAMBE 🍎 — Just arrived from local farms! Enjoy farm-fresh taste today 🌾
📅 Harvest Date: 🔶 26/01/2026 🔶

Now generate the POST-HARVEST notification using the provided crop name and harvest date.
`;
            const aiMessage = await callGemini(prompt);
            await _supabase.from('notifications').insert([{ message: aiMessage, crop_name: name }]);
            alert("Inventory updated and Arrival notification sent!");
        } catch (e) {
            alert("Inventory updated, but AI notification failed.");
        }
    }
}

// --- UPDATED ORDER MANAGEMENT ---

// --- UPDATED ORDER MANAGEMENT ---

async function loadAdminOrders() {
    const { data: orders, error } = await _supabase
        .from('orders')
        .select(`*, crops (name), profiles (name, address)`)
        .neq('status', 'delivered') 
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Fetch error:", error);
        return;
    }

    const div = document.getElementById('admin-order-list');
    div.innerHTML = '';

    if (orders && orders.length > 0) {
        orders.forEach(o => {
            const el = document.createElement('div');
            el.className = 'card';
            // Note the single quotes around 'confirmed' and 'delivered'
            el.innerHTML = `
                <strong>${o.crops?.name || 'Unknown Crop'}</strong> - ${o.quantity} units<br>
                User: ${o.profiles?.name || 'User'}<br>
                Addr: ${o.address || o.profiles?.address || 'No address'}<br>
                Status: <b>${o.status.toUpperCase()}</b><br>
                <div style="margin-top:10px;">
                    <button class="secondary" onclick="updateOrderStatus('${o.id}', 'confirmed')">Confirm</button>
                    <button class="secondary" style="background:#27ae60" onclick="updateOrderStatus('${o.id}', 'delivered')">Deliver</button>
                </div>
            `;
            div.appendChild(el);
        });
        
        // Animate cards with staggered delay
        animateCards(div, 100);
    } else {
        div.innerHTML = '<p>No pending orders.</p>';
    }
}

// FIX: Added alerts, refresh logic, and window export
async function updateOrderStatus(id, status) {
    console.log("Updating order:", id, "to status:", status);
    
    const { error } = await _supabase
        .from('orders')
        .update({ status: status })
        .eq('id', id);
    
    if (error) {
        alert("Error updating order: " + error.message);
        console.error(error);
        return;
    }

    alert("Order " + status + " successfully!");
    
    // Refresh the list immediately
    loadAdminOrders();
}

// CRITICAL: This makes the buttons work!
window.updateOrderStatus = updateOrderStatus;
window.loadAdminOrders = loadAdminOrders;
window.handleLogout = handleLogout; // Ensure logout also works

async function addToExistingStock() {
    const name = document.getElementById('add-stock-crop-name').value;
    const addInput = document.getElementById('add-stock-input');
    const additionalQty = parseInt(addInput.value);

    if (!additionalQty || additionalQty <= 0) {
        return alert("Please enter a valid quantity to add.");
    }

    try {
        // 1. Fetch current quantity
        const { data: crop, error: fetchError } = await _supabase
            .from('crops')
            .select('quantity')
            .eq('name', name)
            .maybeSingle(); // Use maybeSingle to avoid errors if crop isn't found yet

        if (fetchError) throw fetchError;
        
        if (!crop) {
            return alert("Crop not found in database. Please use 'Update Inventory' first to create it.");
        }

        const currentQty = crop.quantity || 0;
        const newTotal = currentQty + additionalQty;

        // 2. Update the Database
        const { error: updateError } = await _supabase
            .from('crops')
            .update({ 
                quantity: newTotal,
                status: 'available' 
            })
            .eq('name', name);

        if (updateError) throw updateError;

        alert(`Success! Added ${additionalQty}. New total for ${name}: ${newTotal}`);
        addInput.value = ''; // Clear input on success
        
    } catch (e) {
        console.error("Stock Update Error:", e);
        alert("Failed to update stock. Check console for details.");
    }


   
    // Refresh list - if status is 'delivered', it will disappear due to .neq filter
    loadAdminOrders();
}