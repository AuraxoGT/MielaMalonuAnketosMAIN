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
            GUILD_ID: "YOUR_SERVER_ID_HERE"
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
        currentUser: null
    };

    // Initialize
    elements.form.appendChild(elements.responseMessage);
    initializeEventListeners();
    checkAuthState();
    setInterval(fetchStatus, 5000);
    fetchStatus();

    // --- Core Functions ---
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

    // --- Discord Integration ---
    async function handleDiscordAuth() {
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
                avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
                presence: presence.presence?.status || "offline",
                activities: presence.activities || []
            };

        } catch (error) {
            console.error("Discord API error:", error);
            throw new Error("Failed to load user data");
        }
    }

    // --- UI Updates ---
    function updateUserInterface(user) {
        if (user) {
            elements.profileContainer.innerHTML = `
                <div class="avatar-wrapper">
                    <img src="${user.avatar}" alt="Avatar">
                    <div class="status-dot ${user.presence}"></div>
                </div>
                <div class="user-info">
                    <p class="username">${user.username}</p>
                    <p class="activity">
                        ${user.activities.length ? 
                            `${user.activities[0].emoji?.name || '🎮'} ${user.activities[0].name}` : 
                            'No active status'}
                    </p>
                </div>
                <button id="logout">Log Out</button>
            `;
            document.getElementById("logout").addEventListener("click", handleLogout);
        }
        toggleAuthElements(!!user);
    }

    // --- Helper Functions ---
    function initializeEventListeners() {
        elements.form.addEventListener("submit", handleFormSubmit);
        elements.statusButton.addEventListener("click", toggleApplicationStatus);
        elements.blacklistButton.addEventListener("click", manageBlacklist);
        elements.removeButton.addEventListener("click", manageBlacklist);
        elements.discordButton.addEventListener("click", handleDiscordAuth);
    }

    function validateSubmissionPrerequisites() {
        if (!state.currentUser) throw new Error("Not authenticated");
        if (state.lastStatus === "offline") throw new Error("Applications closed");
        if (state.blacklist.includes(state.currentUser.id)) throw new Error("User blacklisted");
    }

    async function submitApplication(data) {
        const appId = `${state.currentUser.id.slice(0, 16)}-${Date.now()}`;
        
        const payload = {
            username: "📝 Application System",
            avatar_url: "https://your-valid-avatar-url.com/avatar.png",
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

    // --- Security Functions ---
    function sanitizeInput(input) {
        return String(input)
            .substring(0, 1024)
            .replace(/[@#`*_~]/g, "");
    }

    // --- Admin Functions ---
    async function toggleApplicationStatus() {
        if (!authenticateAdmin()) return;
        const newStatus = state.lastStatus === "online" ? "offline" : "online";
        await updateServerStatus(newStatus);
    }

    // --- Initialization ---
    function checkAuthState() {
        const token = new URLSearchParams(window.location.hash.substring(1)).get("access_token");
        if (token) handleAuthRedirect(token);
        updateUserInterface(JSON.parse(localStorage.getItem("discord_user")));
    }

    async function handleAuthRedirect(token) {
        try {
            state.currentUser = await fetchDiscordUser(token);
            localStorage.setItem("discord_user", JSON.stringify(state.currentUser));
            window.history.replaceState({}, document.title, CONFIG.DISCORD.REDIRECT_URI);
            updateUserInterface(state.currentUser);
        } catch (error) {
            showErrorMessage("Failed to authenticate with Discord");
        }
    }
});

// Additional helper functions would follow...
