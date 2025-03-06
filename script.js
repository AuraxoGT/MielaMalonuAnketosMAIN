document.addEventListener("DOMContentLoaded", async function () {
    console.log("✅ DOM fully loaded!");

    // Configuration (unchanged)
    const CONFIG = {
        JSONBIN: {
            URL: "https://api.jsonbin.io/v3/b/67c851f6e41b4d34e4a1358b",
            KEY: "$2a$10$Fhj82wgpsjkF/dgzbqlWN.bvyoK3jeIBkbQm9o/SSzDo9pxNryLi."
        },
        DISCORD: {
            CLIENT_ID: "1263389179249692693",
            REDIRECT_URI: "https://mielamalonu.xyz",
            SCOPES: ["identify", "guilds.members.read"],
            WEBHOOK_URL: "https://discord.com/api/webhooks/1346529699081490472/k-O-v4wKDiUjsj1w-Achvrej1Kr-W-rXqZVibcftwWFn5sMZyhIMSb9E4r975HbQI3tF",
            GUILD_ID: "1325850250027597845"
        }
    };

    // DOM Elements (unchanged)
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

    // State Management (modified)
    let state = {
        blacklist: [],
        lastStatus: null,
        currentUser: null,
        updateInterval: null,
        adminAuth: false // Memory-only admin auth
    };

    // Initialize (unchanged)
    elements.form.appendChild(elements.responseMessage);
    initializeEventListeners();
    checkAuthState();
    setInterval(fetchStatus, 5000);
    fetchStatus();

    // ======================
    // AUTHENTICATION CHANGES
    // ======================

    function checkAuthState() {
        const token = new URLSearchParams(window.location.hash.substring(1)).get("access_token");
        if (token) {
            handleAuthRedirect(token);
        } else {
            forceLoginState();
        }
    }

    async function handleAuthRedirect(token) {
        try {
            const userData = await fetchDiscordUser(token);
            state.currentUser = {
                ...userData,
                accessToken: token
            };
            window.history.replaceState({}, document.title, window.location.pathname);
            updateUserInterface();
            startPresenceUpdates();
        } catch (error) {
            console.error("Auth error:", error);
            forceLoginState();
        }
    }

    function forceLoginState() {
        state.currentUser = null;
        elements.profileContainer.style.display = "none";
        elements.discordButton.style.display = "block";
    }

    // ======================
    // APPLICATION SUBMISSION (UNCHANGED WORKING VERSION)
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

    // ======================
    // ADMIN FUNCTIONS (MEMORY-ONLY)
    // ======================

    function authenticateAdmin() {
        if (state.adminAuth) return true;
        return requestPassword();
    }

    function requestPassword() {
        const password = prompt("🔑 Enter admin password:");
        if (password === "987412365") {
            state.adminAuth = true;
            alert("✅ Authentication successful!");
            return true;
        }
        alert("❌ Invalid password!");
        return false;
    }

    // ======================
    // UI UPDATES (MODIFIED)
    // ======================

    function updateUserInterface() {
        if (state.currentUser) {
            elements.profileContainer.innerHTML = `
                <div class="avatar-wrapper">
                    <img src="${state.currentUser.avatar}" alt="Avatar">
                    <div class="status-dot ${state.currentUser.status}"></div>
                </div>
                <div class="user-info">
                    <p class="username">${state.currentUser.username}</p>
                    <p class="activity">
                        ${state.currentUser.activities.length > 0 ? 
                            `${state.currentUser.activity.emoji} ${state.currentUser.activity.name}` : 
                            '📡 No active status'}
                    </p>
                </div>
            `;
            elements.discordButton.style.display = "none";
        }
    }

    // Keep all other functions identical to your original working version
    // (fetchStatus, updateApplicationState, createApplicationEmbed, 
    // createActionButtons, fetchDiscordUser, updateDiscordPresence,
    // initializeEventListeners, etc.)
});

// Remove any localStorage/sessionStorage references
