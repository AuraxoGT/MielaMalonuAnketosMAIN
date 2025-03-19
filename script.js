document.addEventListener("DOMContentLoaded", async function () {
    console.log("✅ DOM fully loaded!");

    // Configuration
    const CONFIG = {
        SUPABASE: {
            URL: "https://smodsdsnswwtnbnmzhse.supabase.co", // FIXED: Removed "/rest/v1"
            API_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtb2RzZHNuc3d3dG5ibm16aHNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2MjUyOTAsImV4cCI6MjA1NzIwMTI5MH0.zMdjymIaGU66_y6X-fS8nKnrWgJjXgw7NgXPBIzVCiI",
            STATUS_TABLE: "Status",
            BLACKLIST_TABLE: "Blacklist"
        },
        DISCORD: {
            CLIENT_ID: "1263389179249692693",
            REDIRECT_URI: "https://anketa.mielamalonu.xyz",
            SCOPES: ["identify", "guilds.members.read"],
            WEBHOOK_URL: "https://discord.com/api/webhooks/1346529699081490472/k-O-v4wKDiUjsj1w-Achvrej1Kr-W-rXqZVibcftwWFn5sMZyhIMSb9E4r975HbQI3tF",
            GUILD_ID: "1325850250027597845"
        }
    };

    // Initialize Supabase client
    const { createClient } = supabase;
    const supabaseClient = createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.API_KEY);
    console.log("✅ Supabase client initialized!");

    // DOM Elements
    const elements = {
        form: document.getElementById("applicationForm"),
        statusDisplay: document.getElementById("statusDisplay"),
        discordButton: document.getElementById("discord-login"),
        profileContainer: document.getElementById("profile-container"),
        responseMessage: document.createElement("p")
    };

    // State Management
    let state = {
        blacklist: '',
        lastStatus: null,
        currentUser: null, // Modified: Memory-only Discord auth
        updateInterval: null,
        isSubmitting: false // Added to prevent multiple submissions
    };

    // Initialize
    elements.form.appendChild(elements.responseMessage);
    initializeEventListeners();
    checkAuthState();
    setInterval(fetchStatus, 5000);
    await initializeDatabase(); // New: Make sure database is properly set up
    fetchStatus();

    // Helper function to check if a user is blacklisted - Simplified
    function isUserBlacklisted(userId, blacklistString) {
        // Guard against empty blacklist
        if (!blacklistString || blacklistString.trim() === '') {
            return false;
        }
        
        // Convert userId to string for consistent comparison
        const userIdStr = String(userId).trim();
        
        // Split the blacklist string by commas
        const blacklistedIds = blacklistString.split(',').map(id => id.trim());
        
        // Check if the user ID exists in the blacklisted IDs array
        return blacklistedIds.includes(userIdStr);
    }

    // ======================
    // DATABASE INITIALIZATION
    // ======================

    async function initializeDatabase() {
        try {
            // Check if status record exists
            const { data: statusData, error: statusError } = await supabaseClient
                .from(CONFIG.SUPABASE.STATUS_TABLE)
                .select('*')
                .eq('id', 1);
            
            if (statusError) throw new Error("Failed to check status table");
            
            // If status record doesn't exist, create it with default "online" status
            if (!statusData || statusData.length === 0) {
                console.log("Creating initial status record...");
                const { error: insertError } = await supabaseClient
                    .from(CONFIG.SUPABASE.STATUS_TABLE)
                    .insert({ id: 1, status: 'online' }); // Set default status to online
                
                if (insertError) throw new Error("Failed to create status record");
            }
            
            // Check if blacklist table is initialized
            const { data: blData, error: blError } = await supabaseClient
                .from(CONFIG.SUPABASE.BLACKLIST_TABLE)
                .select('*')
                .eq('id', 1);
            
            // If blacklist record with ID 1 doesn't exist, create it
            if (!blData || blData.length === 0) {
                console.log("Initializing blacklist record...");
                const { error: blInsertError } = await supabaseClient
                    .from(CONFIG.SUPABASE.BLACKLIST_TABLE)
                    .insert({ id: 1, blacklisted_ids: '' });
                
                if (blInsertError) throw new Error("Failed to initialize blacklist");
            }
            
            console.log("✅ Database initialized successfully!");
        } catch (error) {
            console.error("Database initialization error:", error);
        }
    }

    // ======================
    // CORE FUNCTIONS
    // ======================

    async function fetchStatus() {
        try {
            // Fetch application status
            const { data: statusData, error: statusError } = await supabaseClient
                .from(CONFIG.SUPABASE.STATUS_TABLE)
                .select('*')
                .eq('id', 1)
                .single();
            
            if (statusError) {
                throw new Error("Failed to fetch status");
            }
            
            // Force status to be "online" or "offline" only
            let currentStatus = statusData.status;
            if (currentStatus !== "online" && currentStatus !== "offline") {
                currentStatus = "online"; // Default to online if invalid value
                // Update database with correct value
                await supabaseClient
                    .from(CONFIG.SUPABASE.STATUS_TABLE)
                    .update({ status: currentStatus })
                    .eq('id', 1);
            }
            
            // Fetch blacklist - Simplified
            const { data: blacklistData, error: blacklistError } = await supabaseClient
                .from(CONFIG.SUPABASE.BLACKLIST_TABLE)
                .select('*')
                .eq('id', 1)
                .single();
            
            if (blacklistError) {
                throw new Error("Failed to fetch blacklist");
            }
            
            // Process blacklist data
            let blacklistedIds = '';
            if (blacklistData) {
                if (typeof blacklistData.blacklisted_ids === 'string') {
                    blacklistedIds = blacklistData.blacklisted_ids;
                } else if (Array.isArray(blacklistData.blacklisted_ids)) {
                    blacklistedIds = blacklistData.blacklisted_ids.join(',');
                } else if (Array.isArray(blacklistData.blacklist)) {
                    blacklistedIds = blacklistData.blacklist.join(',');
                } else if (blacklistData.blacklisted_ids !== null && blacklistData.blacklisted_ids !== undefined) {
                    blacklistedIds = String(blacklistData.blacklisted_ids);
                }
            }
            
            // Update application state
            updateApplicationState({
                status: currentStatus,
                blacklist: blacklistedIds
            });
        } catch (error) {
            console.error("❌ Status fetch error:", error);
            showErrorMessage("Failed to load application status. Check console for details.");
        }
    }

    function updateApplicationState(data) {
        const newBlacklist = data.blacklist || '';
        
        if (state.lastStatus !== data.status || state.blacklist !== newBlacklist) {
            state.lastStatus = data.status;
            state.blacklist = newBlacklist;
            updateStatusDisplay();
            
            // Update UI based on current state
            updateFormState();
        }
    }

    // Single function to update form state
    function updateFormState() {
        if (!elements.form) return;
        
        const submitBtn = elements.form.querySelector('button[type="submit"]');
        if (!submitBtn) return;
        
        // Only enable if all conditions are met
        const isLoggedIn = !!state.currentUser;
        const isBlacklisted = isLoggedIn && isUserBlacklisted(state.currentUser.id, state.blacklist);
        const isOnline = state.lastStatus === "online";
        
        submitBtn.disabled = !isLoggedIn || isBlacklisted || !isOnline || state.isSubmitting;
        
        // Handle messages
        if (isBlacklisted) {
            showErrorMessage("🚫 Jūs esate užblokuotas ir negalite pateikti anketos!");
        } else if (!isOnline) {
            showErrorMessage("❌ Aplikacijos šiuo metu nepriimamos!");
        } else if (!isLoggedIn) {
            showErrorMessage("❌ Prieš pateikiant anketą, reikia prisijungti prie Discord!");
        } else {
            clearMessages();
        }
    }

    // ======================
    // FORM HANDLING
    // ======================

    async function handleFormSubmit(event) {
        event.preventDefault();
        
        // Prevent multiple submissions
        if (state.isSubmitting) return;
        state.isSubmitting = true;
        
        clearMessages();

        const submitButton = event.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = "Pateikiama...";

        try {
            // Validate all requirements in one go
            await validateAllRequirements();
            
            // If validation passes, gather data and submit
            const formData = gatherFormData();
            await submitApplication(formData);

            submitButton.textContent = "Pateikta!";
            showSuccessMessage("✅ Aplikacija pateikta!");
            elements.form.reset();
            
        } catch (error) {
            handleSubmissionError(error);
            submitButton.textContent = "Bandykite dar kartą";
        } finally {
            // Reset submission state after delay
            setTimeout(() => {
                state.isSubmitting = false;
                submitButton.textContent = "Pateikti";
                submitButton.disabled = false;
                updateFormState();
            }, 3000);
        }
    }

    // Combined validation function
    async function validateAllRequirements() {
        // Check authentication
        if (!state.currentUser) {
            throw new Error("Discord authentication required");
        }
        
        // Check application status
        if (state.lastStatus !== "online") {
            throw new Error("Applications closed");
        }
        
        // Check blacklist - single check
        if (isUserBlacklisted(state.currentUser.id, state.blacklist)) {
            throw new Error("User blacklisted");
        }
        
        // Check user role
        try {
            const response = await fetch("https://mmapi-1.onrender.com/api/check-role", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId: state.currentUser.id })
            });

            if (!response.ok) throw new Error("Server error while checking role");
            const data = await response.json();

            if (data.hasRole) throw new Error("LA");
        } catch (error) {
            throw error;
        }
    }

    function gatherFormData() {
        return {
            userId: state.currentUser.id,
            age: document.getElementById("age").value.trim(),
            reason: document.getElementById("whyJoin").value.trim(),
            pl: document.getElementById("pl").value.trim(),
            kl: document.getElementById("kl").value.trim(),
            pc: document.getElementById("pc").value.trim(),
            isp: document.getElementById("isp").value.trim()
        };
    }

    async function submitApplication(data) {
        const appId = `${state.currentUser.id.slice(0, 16)}-${Date.now()}`;

        const payload = {
            variables: [
                { name: "userId", variable: "{event_userId}", value: `${data.userId}` },
                { name: "age", variable: "{event_age}", value: `${data.age}` },
                { name: "reason", variable: "{event_reason}", value: `${data.reason}` },
                { name: "pl", variable: "{event_pl}", value: `${data.pl}/10` },
                { name: "kl", variable: "{event_kl}", value: `${data.kl}/10` },
                { name: "pc", variable: "{event_pc}", value: `${data.pc}` },
                { name: "isp", variable: "{event_isp}", value: `${data.isp}` },
                { name: "applicationId", variable: "{event_appId}", value: `${appId}` }
            ]
        };

        const response = await fetch("https://proxy-sxyf.onrender.com/send-to-botghost", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "ef0576a7eb018e3d7cb3a7d4564069245fa8a9fb2b4dd74b5bd3d20c19983041"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("BotGhost API error");
    }

    // ======================
    // DISCORD INTEGRATION (MODIFIED)
    // ======================

    function handleDiscordAuth() {
        const authUrl = new URL("https://discord.com/api/oauth2/authorize");
        authUrl.searchParams.append("client_id", CONFIG.DISCORD.CLIENT_ID);
        authUrl.searchParams.append("redirect_uri", CONFIG.DISCORD.REDIRECT_URI);
        authUrl.searchParams.append("response_type", "token");
        authUrl.searchParams.append("scope", CONFIG.DISCORD.SCOPES.join(" "));
        window.location.href = authUrl.toString();
    }

    async function fetchDiscordUser(token) {
        try {
            const [userData, presenceData] = await Promise.all([
                fetch("https://discord.com/api/users/@me", {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`https://discord.com/api/v10/users/@me/guilds/${CONFIG.DISCORD.GUILD_ID}/member`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            const user = await userData.json();
            const presence = await presenceData.json();

            if (!user.id) throw new Error("Invalid user data");
            
            const status = presence.presence?.status || 'offline';
            const activities = presence.activities || [];
            const mainActivity = activities.find(a => a.type === 0) || {};

            return {
                ...user,
                avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`,
                status: status,
                activities: activities,
                activity: {
                    name: mainActivity.name || '',
                    details: mainActivity.details || '',
                    state: mainActivity.state || '',
                    emoji: mainActivity.emoji?.name || '🎮'
                }
            };

        } catch (error) {
            console.error("Discord API error:", error);
            return { status: 'offline', activities: [] };
        }
    }

    async function updateDiscordPresence() {
        if (!state.currentUser) return;
        
        try {
            const user = await fetchDiscordUser(state.currentUser.accessToken);
            if (user.status !== state.currentUser.status || 
                JSON.stringify(user.activities) !== JSON.stringify(state.currentUser.activities)) {
                state.currentUser = { ...user, accessToken: state.currentUser.accessToken };
                updateUserInterface(state.currentUser);
            }
        } catch (error) {
            console.error("Presence update error:", error);
        }
    }

    // ======================
    // UI MANAGEMENT (MODIFIED)
    // ======================

    function updateUserInterface(user) {
        if (user) {
            elements.profileContainer.innerHTML = `
                <div class="avatar-wrapper">
                    <img src="${user.avatar}" alt="Avatar">
                    <div class="status-dot ${user.status}"></div>
                </div>
                <div class="user-info">
                    <p class="username">${user.username}</p>
                    ${user.status === 'dnd' ? '<div class="dnd-banner">Do Not Disturb</div>' : ''}
                </div>
                <button id="logout">Log Out</button>
            `;
            document.getElementById("logout").addEventListener("click", handleLogout);
        }
        
        toggleAuthElements(!!user);
        updateFormState();
    }

    function toggleAuthElements(isLoggedIn) {
        // Hide login button when logged in, show profile when logged in
        elements.discordButton.style.display = isLoggedIn ? 'none' : 'block';
        elements.profileContainer.style.display = isLoggedIn ? 'flex' : 'none';
    }

    function startPresenceUpdates() {
        if (state.updateInterval) clearInterval(state.updateInterval);
        state.updateInterval = setInterval(updateDiscordPresence, 50000000);
    }

    // ======================
    // MESSAGE HANDLING FUNCTIONS
    // ======================

    function clearMessages() {
        elements.responseMessage.textContent = "";
        elements.responseMessage.className = "";
    }

    function showErrorMessage(message) {
        elements.responseMessage.textContent = message;
        elements.responseMessage.className = "error-message";
    }

    function showSuccessMessage(message) {
        elements.responseMessage.textContent = message;
        elements.responseMessage.className = "success-message";
    }

    // ======================
    // UTILITY FUNCTIONS
    // ======================

    function initializeEventListeners() {
        elements.form.addEventListener("submit", handleFormSubmit);
        elements.discordButton.addEventListener("click", handleDiscordAuth);
    }

    function checkAuthState() {
        const token = new URLSearchParams(window.location.hash.substring(1)).get("access_token");
        if (token) handleAuthRedirect(token);
        updateUserInterface(state.currentUser);
    }

    async function handleAuthRedirect(token) {
        try {
            const userData = await fetchDiscordUser(token);
            state.currentUser = {
                ...userData,
                accessToken: token
            };
            window.history.replaceState({}, document.title, window.location.pathname);
            updateUserInterface(state.currentUser);
            startPresenceUpdates();
            updateFormState();
        } catch (error) {
            showErrorMessage("Failed to authenticate with Discord");
        }
    }

    function handleLogout() {
        clearInterval(state.updateInterval);
        state.currentUser = null;
        updateUserInterface(null);
        location.reload();
    }

    function updateStatusDisplay() {
        if (state.lastStatus === "online") {
            elements.statusDisplay.textContent = "✅ Atidaryta ✅";
            elements.statusDisplay.className = "status-online";
        } else {
            elements.statusDisplay.textContent = "❌ Uždaryta ❌";
            elements.statusDisplay.className = "status-offline";
        }
    }

    function handleSubmissionError(error) {
        console.error("Submission error:", error);
        switch(error.message) {
            case "Discord authentication required":
                showErrorMessage("❌ Prieš pateikiant anketą, reikia prisijungti su Discord!");
                break;
            case "Applications closed":
                showErrorMessage("❌ Aplikacijos šiuo metu nepriimamos!");
                break;
            case "User blacklisted":
                showErrorMessage("🚫 Jūs esate užblokuotas ir negalite pateikti anketos!");
                break;
            case "LA":
                showErrorMessage("❌ Jūs jau esate užpildęs anketa!");
                break;
            default:
                showErrorMessage("❌ Įvyko klaida pateikiant anketą. Bandykite dar kartą.");
        }
    }

    async function fetchDiscordInvite(inviteCode, containerClass) {
        try {
            const response = await fetch(`https://discord.com/api/v9/invites/${inviteCode}?with_counts=true`);
            const data = await response.json();

            if (data.guild) {
                const container = document.querySelector(`.${containerClass}`);
                if (!container) return console.error("Container not found!");

                // Remove any existing invite before adding a new one
                const oldInvite = container.querySelector(".discord-invite");
                if (oldInvite) oldInvite.remove();

                // Create the Discord invite HTML structure dynamically
                const inviteHTML = `
                    <div class="discord-invite">
                        <div class="invite-banner">
                            ${data.guild.banner ? `<img src="https://cdn.discordapp.com/banners/${data.guild.id}/${data.guild.banner}.png?size=600" alt="Server Banner">` : ""}
                        </div>
                        <div class="invite-content">
                            <img src="https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png" alt="Server Icon" class="server-icon">
                            <div class="server-info">
                                <h3>${data.guild.name}</h3>
                                <p>${data.approximate_presence_count} Online • ${data.approximate_member_count} Members</p>
                            </div>
                            <a href="https://discord.gg/${inviteCode}" target="_blank" class="join-button">Join</a>
                        </div>
                    </div>
                `;

                container.insertAdjacentHTML("beforeend", inviteHTML);
            }
        } catch (error) {
            console.error("Error fetching Discord invite:", error);
        }
    }

    // Call function and pass the container class where you want the invite to be displayed
    fetchDiscordInvite("mielamalonu", "rules-container");
});
