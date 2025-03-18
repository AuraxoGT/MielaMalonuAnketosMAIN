document.addEventListener("DOMContentLoaded", async function () {
    console.log("✅ DOM fully loaded!");

    // Configuration
    const CONFIG = {
        SUPABASE: {
            URL: "https://smodsdsnswwtnbnmzhse.supabase.co",
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

    const { createClient } = supabase;
    const supabaseClient = createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.API_KEY);
    console.log("✅ Supabase client initialized!");

    // DOM Elements
    const elements = {
        form: document.getElementById("applicationForm"),
        statusDisplay: document.getElementById("statusDisplay"),
        statusButton: document.getElementById("statusButton"),
        blacklistButton: document.getElementById("blacklistButton"),
        removeButton: document.getElementById("removeButton"),
        discordButton: document.getElementById("discord-login"),
        profileContainer: document.getElementById("profile-container"),
        responseMessage: document.createElement("p")
    };

    // State Management
    let state = {
        blacklist: [],
        lastStatus: null,
        currentUser: null,
        updateInterval: null
    };

    // Initialize
    elements.form.appendChild(elements.responseMessage);
    initializeEventListeners();
    checkAuthState();
    setInterval(fetchStatus, 5000);
    await initializeDatabase();
    fetchStatus();

    // ======================
    // DATABASE INITIALIZATION
    // ======================
    async function initializeDatabase() {
        try {
            // Status table setup
            const { data: statusData, error: statusError } = await supabaseClient
                .from(CONFIG.SUPABASE.STATUS_TABLE)
                .select('*')
                .eq('id', 1);
            
            if (statusError) throw statusError;
            
            if (!statusData?.length) {
                const { error } = await supabaseClient
                    .from(CONFIG.SUPABASE.STATUS_TABLE)
                    .insert({ id: 1, status: 'online' });
                if (error) throw error;
            }
            
            // Blacklist table setup
            const { data: blData, error: blError } = await supabaseClient
                .from(CONFIG.SUPABASE.BLACKLIST_TABLE)
                .select('*')
                .eq('id', 1);
            
            if (!blData?.length) {
                const { error } = await supabaseClient
                    .from(CONFIG.SUPABASE.BLACKLIST_TABLE)
                    .insert({ id: 1, blacklisted_ids: [] });
                if (error) throw error;
            }
            
            console.log("✅ Database initialized!");
        } catch (error) {
            console.error("Database init error:", error);
        }
    }

    // ======================
    // CORE FUNCTIONS
    // ======================
    async function fetchStatus() {
        try {
            // Get current status
            const { data: statusData, error: statusError } = await supabaseClient
                .from(CONFIG.SUPABASE.STATUS_TABLE)
                .select('*')
                .eq('id', 1)
                .single();
            
            if (statusError) throw statusError;
            
            let currentStatus = statusData.status;
            if (!["online", "offline"].includes(currentStatus)) {
                currentStatus = "online";
                await supabaseClient
                    .from(CONFIG.SUPABASE.STATUS_TABLE)
                    .update({ status: currentStatus })
                    .eq('id', 1);
            }
            
            // Get blacklist (FIXED)
            const { data: blacklistData, error: blacklistError } = await supabaseClient
                .from(CONFIG.SUPABASE.BLACKLIST_TABLE)
                .select('blacklisted_ids')
                .eq('id', 1)
                .single();

            updateApplicationState({
                status: currentStatus,
                blacklist: blacklistData?.blacklisted_ids || []
            });
            
        } catch (error) {
            console.error("❌ Status fetch error:", error);
            showErrorMessage("Failed to load status. Check console.");
        }
    }

    function updateApplicationState(data) {
        const newBlacklist = Array.isArray(data.blacklist) ? data.blacklist : [];
        
        if (state.lastStatus !== data.status || 
            JSON.stringify(state.blacklist) !== JSON.stringify(newBlacklist)) {
            state.lastStatus = data.status;
            state.blacklist = newBlacklist;
            updateStatusDisplay();
            console.log("State updated - Status:", state.lastStatus, "Blacklist:", state.blacklist);
        }
    }

    // ======================
    // FORM HANDLING (FIXED)
    // ======================
    async function handleFormSubmit(event) {
        event.preventDefault();
        clearMessages();

        const submitButton = event.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = "Pateikiama...";

        try {
            if (!state.currentUser) throw new Error("Discord authentication required");
            
            await fetchStatus();
            
            // Fixed blacklist check
            if (state.blacklist.some(id => String(id) === String(state.currentUser.id))) {
                console.log("🚫 Blacklisted user blocked");
                throw new Error("User blacklisted");
            }
            
            await validateUserRole();
            validateSubmissionPrerequisites();
            await submitApplication(gatherFormData());

            submitButton.textContent = "Pateikta!";
            setTimeout(() => {
                submitButton.textContent = "Pateikti";
                submitButton.disabled = false;
            }, 3000);

        } catch (error) {
            handleSubmissionError(error);
            submitButton.textContent = "Bandykite dar kartą";
            setTimeout(() => submitButton.disabled = false, 3000);
        }
    }

    async function validateUserRole() {
        try {
            const response = await fetch("https://mmapi.onrender.com/api/check-role", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId: state.currentUser.id })
            });

            if (!response.ok) throw new Error("Server error while checking role");
            const data = await response.json();

            if (data.hasRole) throw new Error("LA")
        } catch (error) {
            showErrorMessage(error.message);
            throw error;
        }
    }

    function validateSubmissionPrerequisites() {
        if (!state.currentUser) throw new Error("Discord authentication required");
        if (state.lastStatus === "offline") throw new Error("Applications closed");
        
        if (state.blacklist.some(id => String(id) === String(state.currentUser.id))) {
            throw new Error("User blacklisted");
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
        if (state.blacklist.some(id => String(id) === String(data.userId))) {
            throw new Error("User blacklisted");
        }

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

        try {
            const response = await fetch("https://proxy-sxyf.onrender.com/send-to-botghost", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "ef0576a7eb018e3d7cb3a7d4564069245fa8a9fb2b4dd74b5bd3d20c19983041"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("BotGhost API error");
            showSuccessMessage("✅ Aplikacija pateikta!");
            elements.form.reset();
        } catch (error) {
            console.error("Submission error:", error);
            showErrorMessage("❌ Nepavyko išsiųsti aplikacijos. Bandykite dar kartą.");
        }
    }

    // ======================
    // DISCORD INTEGRATION
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
            
            return {
                ...user,
                avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`,
                status: presence.presence?.status || 'offline',
                activities: presence.activities || [],
                activity: presence.activities?.find(a => a.type === 0) || {}
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
    // UI MANAGEMENT
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
                    <p class="activity">
                        ${user.activities.length > 0 ? 
                            `${user.activity.emoji?.name || '🎮'} ${user.activity.name}` : 
                            '📡 No active status'}
                    </p>
                    ${user.status === 'dnd' ? '<div class="dnd-banner">Do Not Disturb</div>' : ''}
                </div>
                <button id="logout">Log Out</button>
            `;
            document.getElementById("logout").addEventListener("click", handleLogout);
        }
        toggleAuthElements(!!user);
    }

    function startPresenceUpdates() {
        if (state.updateInterval) clearInterval(state.updateInterval);
        state.updateInterval = setInterval(updateDiscordPresence, 5000);
    }

    // ======================
    // ADMIN FUNCTIONS
    // ======================
    async function addToBlacklist() {
        if (!authenticateAdmin()) return;
        
        const newId = prompt("🚫 Enter User ID to blacklist:");
        if (!newId || state.blacklist.includes(newId)) {
            alert(`⚠️ Invalid or already blacklisted: ${newId}`);
            return;
        }

        try {
            state.blacklist.push(newId);
            const { error } = await supabaseClient
                .from(CONFIG.SUPABASE.BLACKLIST_TABLE)
                .update({ blacklisted_ids: state.blacklist })
                .eq('id', 1);
                
            if (error) throw error;
            alert(`✅ Blacklisted ${newId}`);
        } catch (error) {
            console.error("Blacklist error:", error);
            alert(`❌ Failed: ${error.message}`);
            state.blacklist = state.blacklist.filter(id => id !== newId);
        }
    }

    async function removeFromBlacklist() {
        if (!authenticateAdmin()) return;

        const idToRemove = prompt("❌ Enter User ID to unblock:");
        if (!idToRemove || !state.blacklist.includes(idToRemove)) {
            alert(`⚠️ Not in blacklist: ${idToRemove}`);
            return;
        }

        const original = [...state.blacklist];
        state.blacklist = state.blacklist.filter(id => id !== idToRemove);
        
        try {
            const { error } = await supabaseClient
                .from(CONFIG.SUPABASE.BLACKLIST_TABLE)
                .update({ blacklisted_ids: state.blacklist })
                .eq('id', 1);
                
            if (error) throw error;
            alert(`✅ Removed ${idToRemove}`);
        } catch (error) {
            console.error("Remove error:", error);
            alert(`❌ Failed: ${error.message}`);
            state.blacklist = original;
        }
    }

    function authenticateAdmin() {
        if (sessionStorage.getItem("adminAuth") === "true") return true;
        const password = prompt("🔑 Admin password:");
        if (password === "987412365") {
            sessionStorage.setItem("adminAuth", "true");
            alert("✅ Authenticated!");
            return true;
        }
        alert("❌ Invalid password!");
        return false;
    }

    // ======================
    // UTILITY FUNCTIONS
    // ======================
    function initializeEventListeners() {
        elements.form.addEventListener("submit", handleFormSubmit);
        elements.statusButton.addEventListener("click", toggleApplicationStatus);
        elements.blacklistButton.addEventListener("click", addToBlacklist);
        elements.removeButton.addEventListener("click", removeFromBlacklist);
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
        } catch (error) {
            showErrorMessage("Authentication failed");
        }
    }

    function handleLogout() {
        clearInterval(state.updateInterval);
        state.currentUser = null;
        updateUserInterface(null);
        location.reload();
    }

    async function toggleApplicationStatus() {
        if (!authenticateAdmin()) return;
        const newStatus = state.lastStatus === "online" ? "offline" : "online";
        
        try {
            const { error } = await supabaseClient
                .from(CONFIG.SUPABASE.STATUS_TABLE)
                .update({ status: newStatus })
                .eq('id', 1);
                
            if (error) throw error;
            state.lastStatus = newStatus;
            updateStatusDisplay();
            alert(`✅ Status: ${newStatus.toUpperCase()}`);
        } catch (error) {
            console.error("Status error:", error);
            showErrorMessage("Status update failed");
        }
    }

    function handleSubmissionError(error) {
        const messages = {
            "Discord authentication required": "❌ Prisijunkite per Discord!",
            "Applications closed": "❌ Anketos uždarytos!",
            "User blacklisted": "🚫 Jūs užblokuoti!",
            "LA": "🚫 Jau pateikėte anketą!",
        };
        showErrorMessage(messages[error.message] || "❌ Klaida. Bandykite dar kartą.");
    }

    function toggleAuthElements(authenticated) {
        elements.profileContainer.style.display = authenticated ? "flex" : "none";
        elements.discordButton.style.display = authenticated ? "none" : "block";
    }

    function updateStatusDisplay() {
        elements.statusDisplay.textContent = state.lastStatus === "online" 
            ? "✅ Atidaryta ✅" 
            : "❌ Uždaryta ❌";
        
        elements.statusDisplay.className = `status-${state.lastStatus}`;
        elements.statusButton.textContent = state.lastStatus === "online" 
            ? "🟢 Uždaryti Anketas" 
            : "🔴 Atidaryti Anketas";
    }

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
    // INITIALIZATION
    // ======================
    async function fetchDiscordInvite(inviteCode, containerClass) {
        try {
            const response = await fetch(`https://discord.com/api/v9/invites/${inviteCode}?with_counts=true`);
            const data = await response.json();

            if (data.guild) {
                const container = document.querySelector(`.${containerClass}`);
                if (container) {
                    container.insertAdjacentHTML("beforeend", `
                        <div class="discord-invite">
                            <div class="invite-banner">
                                ${data.guild.banner ? `<img src="https://cdn.discordapp.com/banners/${data.guild.id}/${data.guild.banner}.png?size=600" alt="Banner">` : ""}
                            </div>
                            <div class="invite-content">
                                <img src="https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png" alt="Icon" class="server-icon">
                                <div class="server-info">
                                    <h3>${data.guild.name}</h3>
                                    <p>${data.approximate_presence_count} Online • ${data.approximate_member_count} Members</p>
                                </div>
                                <a href="https://discord.gg/${inviteCode}" target="_blank" class="join-button">Join</a>
                            </div>
                        </div>
                    `);
                }
            }
        } catch (error) {
            console.error("Invite fetch error:", error);
        }
    }

    fetchDiscordInvite("mielamalonu", "rules-container");
});
