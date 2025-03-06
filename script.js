document.addEventListener("DOMContentLoaded", async function () {
    console.log("✅ DOM fully loaded!");

    // Configuration
    const CONFIG = {
        JSONBIN: {
            URL: "https://api.jsonbin.io/v3/b/67c851f6e41b4d34e4a1358b",
            KEY: "$2a$10$Fhj82wgpsjkF/dgzbqlWN.bvyoK3jeIBkbQm9o/SSzDo9pxNryLi."
        },
        DISCORD: {
            CLIENT_ID: "1263389179249692693",
            REDIRECT_URI: "https://auraxogt.github.io/mmwebtest/",
            SCOPES: ["identify", "guilds.members.read"],
            WEBHOOK_URL: "https://discord.com/api/webhooks/1346529699081490472/k-O-v4wKDiUjsj1w-Achvrej1Kr-W-rXqZVibcftwWFn5sMZyhIMSb9E4r975HbQI3tF",
            GUILD_ID: "1325850250027597845"
        }
    };

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
    fetchStatus();

    // ======================
    // CORE FUNCTIONS
    // ======================

    async function fetchStatus() {
        try {
            const response = await fetch(CONFIG.JSONBIN.URL, {
                headers: { "X-Master-Key": CONFIG.JSONBIN.KEY }
            });
            const data = await response.json();
            
            if (!response.ok) throw new Error("Failed to fetch status");
            updateApplicationState(data.record);
            
        } catch (error) {
            console.error("❌ Status fetch error:", error);
            showErrorMessage("Failed to load application status");
        }
    }

    function updateApplicationState(data) {
        if (state.lastStatus !== data.status || JSON.stringify(state.blacklist) !== JSON.stringify(data.blacklist)) {
            state.lastStatus = data.status;
            state.blacklist = data.blacklist || [];
            updateStatusDisplay();
            console.log("🔄 Application state updated");
        }
    }

    // ======================
    // FORM HANDLING
    // ======================

    async function handleFormSubmit(event) {
        event.preventDefault();
        clearMessages();

        try {
            validateSubmissionPrerequisites();
            const formData = gatherFormData();
            await submitApplication(formData);
            
        } catch (error) {
            handleSubmissionError(error);
        }
    }

    function validateSubmissionPrerequisites() {
        if (!state.currentUser) throw new Error("Not authenticated");
        if (state.lastStatus === "offline") throw new Error("Applications closed");
        if (state.blacklist.includes(state.currentUser.id)) throw new Error("User blacklisted");
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
            username: "📝 Application System",
            avatar_url: "https://example.com/avatar.png",
            embeds: [createApplicationEmbed(data, appId)],
            components: [createActionButtons(appId)]
        };

        const response = await fetch(CONFIG.DISCORD.WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Discord API error");
        showSuccessMessage("✅ Aplikacija pateikta!");
        elements.form.reset();
    }

    function createApplicationEmbed(data, appId) {
        return {
            title: "📢 Nauja Aplikacija!",
            color: 0x000000,
            fields: [
                { name: "👤 Asmuo", value: `<@${userId}>`, inline: true },
                { name: "🎂 Metai", value: `**${age}**`, inline: true },
                { name: "📝 Kodėl nori prisijungti?", value: `**${reason}**`, inline: true },
                { name: "🔫 Pašaudymo lygis", value: `**${pl} / 10**`, inline: true },
                { name: "📞 Komunikacijos lygis", value: `**${kl} / 10**`, inline: true },
                { name: "🖥️ PC Check", value: `**${pc}**`, inline: true },
                { name: "🚫 Ispėjimo išpirkimas", value: `**${isp}**`, inline: true },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: `Application ID: ${appId}` }
        };
    }

    function createActionButtons(appId) {
        const sanitizedId = appId.replace(/[^a-z0-9_-]/gi, "");
        return {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 3,
                    label: "Patvirtinti",
                    custom_id: `accept_${sanitizedId}`,
                    emoji: { name: "✅" }
                },
                {
                    type: 2,
                    style: 4,
                    label: "Atmesti",
                    custom_id: `reject_${sanitizedId}`,
                    emoji: { name: "❌" }
                }
            ]
        };
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
                            `${user.activity.emoji} ${user.activity.name}` : 
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
    // LOGGING OUT
    // ======================

    function handleLogout() {
        state.currentUser = null;
        updateUserInterface(null);
        clearInterval(state.updateInterval);
        state.updateInterval = null;
        toggleAuthElements(false);
    }

    // ======================
    // ERROR HANDLING
    // ======================

    function handleSubmissionError(error) {
        console.error("❌ Form submission error:", error);
        if (error.message === "Not authenticated") {
            showErrorMessage("Please log in first.");
        } else if (error.message === "Applications closed") {
            showErrorMessage("Applications are currently closed.");
        } else if (error.message === "User blacklisted") {
            showErrorMessage("You are blacklisted from applying.");
        } else {
            showErrorMessage("An unknown error occurred. Please try again.");
        }
    }

    function showErrorMessage(message) {
        elements.responseMessage.textContent = message;
        elements.responseMessage.classList.add("error");
    }

    function showSuccessMessage(message) {
        elements.responseMessage.textContent = message;
        elements.responseMessage.classList.add("success");
    }

    function clearMessages() {
        elements.responseMessage.textContent = '';
        elements.responseMessage.classList.remove("error", "success");
    }

    // ======================
    // AUTH STATE HANDLING
    // ======================

    function toggleAuthElements(isAuthenticated) {
        elements.discordButton.style.display = isAuthenticated ? "none" : "inline-block";
        elements.removeButton.style.display = isAuthenticated ? "inline-block" : "none";
        elements.blacklistButton.style.display = isAuthenticated && !state.blacklist.includes(state.currentUser.id) ? "inline-block" : "none";
        elements.statusButton.style.display = isAuthenticated ? "inline-block" : "none";
    }

    async function checkAuthState() {
        const token = new URLSearchParams(window.location.hash).get("access_token");
        if (token) {
            state.currentUser = await fetchDiscordUser(token);
            state.currentUser.accessToken = token;
            updateUserInterface(state.currentUser);
            startPresenceUpdates();
        }
    }

    // ======================
    // BUTTON EVENT LISTENERS
    // ======================

    function initializeEventListeners() {
        elements.form.addEventListener("submit", handleFormSubmit);
        elements.discordButton.addEventListener("click", handleDiscordAuth);
        elements.removeButton.addEventListener("click", handleLogout);
        elements.blacklistButton.addEventListener("click", handleBlacklistUser);
        elements.statusButton.addEventListener("click", handleToggleStatus);
    }

    // ======================
    // ADMIN CONTROLS
    // ======================

    async function handleBlacklistUser() {
        if (!state.currentUser) return;
        state.blacklist.push(state.currentUser.id);
        await saveBlacklist();
        showSuccessMessage("User blacklisted!");
    }

    async function handleToggleStatus() {
        if (state.lastStatus === "online") {
            state.lastStatus = "offline";
            elements.statusButton.textContent = "Make Online";
        } else {
            state.lastStatus = "online";
            elements.statusButton.textContent = "Make Offline";
        }

        await saveStatus();
    }

    async function saveBlacklist() {
        try {
            const response = await fetch(CONFIG.JSONBIN.URL, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-Master-Key": CONFIG.JSONBIN.KEY
                },
                body: JSON.stringify({
                    record: {
                        blacklist: state.blacklist,
                        status: state.lastStatus
                    }
                })
            });
            if (!response.ok) throw new Error("Failed to update blacklist");
            console.log("✅ Blacklist updated");
        } catch (error) {
            console.error("❌ Failed to save blacklist", error);
            showErrorMessage("Failed to save blacklist");
        }
    }

    async function saveStatus() {
        try {
            const response = await fetch(CONFIG.JSONBIN.URL, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-Master-Key": CONFIG.JSONBIN.KEY
                },
                body: JSON.stringify({
                    record: {
                        blacklist: state.blacklist,
                        status: state.lastStatus
                    }
                })
            });
            if (!response.ok) throw new Error("Failed to update status");
            console.log("✅ Status updated");
        } catch (error) {
            console.error("❌ Failed to save status", error);
            showErrorMessage("Failed to save status");
        }
    }
});
