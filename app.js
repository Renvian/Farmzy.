// 1. Initialize Supabase
// REPLACE THESE WITH YOUR OWN SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://ivbtqasfcrckzlbzzqyl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2YnRxYXNmY3Jja3psYnp6cXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODYxOTcsImV4cCI6MjA4MzU2MjE5N30.bA_X9xFaTAdSFdlMK12NdjFG6QuH4_1srtlT8tiSwyw';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Global State
let currentUser = null;
let userProfile = null;

// 3. Auth Checker & Redirect
async function checkAuth(requiredRole = null) {
    const { data: { session } } = await _supabase.auth.getSession();
    
    if (!session) {
        if (!window.location.pathname.includes('login') && !window.location.pathname.includes('signup')) {
            window.location.href = 'login.html';
        }
        return;
    }

    currentUser = session.user;
    
    // Fetch Profile
    const { data: profile } = await _supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    userProfile = profile;

    // Role Guard
    if (requiredRole && profile.role !== requiredRole) {
        alert('Unauthorized access');
        window.location.href = profile.role === 'admin' ? 'admin.html' : 'home.html';
    }
}

// 4. Logout Function
async function handleLogout() {
    await _supabase.auth.signOut();
    window.location.href = 'login.html';
}

// 5. Notification Logic (Shared)
async function fetchNotifications() {
    // Admins see all notifications they sent? No, usually notifs are for users.
    // For this prototype, fetch broadcast notifications + specific user ones
    const { data, error } = await _supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    const list = document.getElementById('notif-list');
    list.innerHTML = '';
    
    if(data) {
        data.forEach(n => {
            const item = document.createElement('div');
            item.className = 'card';
            item.style.marginBottom = '10px';
            item.innerHTML = `<small>${new Date(n.created_at).toLocaleDateString()}</small><p>${n.message}</p>`;
            list.appendChild(item);
        });
    }

}

function toggleNotifications() {
    const overlay = document.getElementById('notif-overlay');
    
    if (!overlay) {
        console.error("Error: Element #notif-overlay not found in the HTML!");
        return;
    }

    // Toggle logic
    if (overlay.style.display === 'none' || overlay.style.display === '') {
        overlay.style.display = 'flex';
        fetchNotifications(); // Fetch latest notifications when opened
    } else {
        overlay.style.display = 'none';
    }
}

// Make it global so the button can see it
window.toggleNotifications = toggleNotifications;

// Truck Loading Animation Function
function hideLoadingAnimation() {
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.classList.add('hidden');
        setTimeout(function() {
            loader.style.display = 'none';
        }, 500);
    }
}

// Auto-hide loading animation after page loads
document.addEventListener('DOMContentLoaded', function() {
    // Hide the loader after a short delay to show the animation
    setTimeout(hideLoadingAnimation, 2000);
});
