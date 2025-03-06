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
            REDIRECT_URI: "https://mielamalonu.xyz",
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
    // CORE FUNCTIONS (Keep all previous core functions unchanged)
    // ======================

    // ======================
    // AUTHENTICATION CHANGES
    // ======================

    function checkAuthState() {
        const token = new URLSearchParams(window.location.hash.substring(1)).get("access_token");
        if (token) {
            handleAuthRedirect(token);
        } else {
            // Force Discord login if no token
            elements.profileContainer.style.display = "none";
            elements.discordButton.style.display = "block";
        }
    }

    async function handleAuthRedirect(token) {
        try {
            const userData = await fetchDiscordUser(token);
            if (!userData.id) throw new Error("Invalid user data");
            
            state.currentUser = {
                ...userData,
                accessToken: token
            };
            
            // Clear URL hash after authentication
            window.history.replaceState({}, document.title, window.location.pathname);
            updateUserInterface(state.currentUser);
            startPresenceUpdates();
            
        } catch (error) {
            console.error("Authentication error:", error);
            showErrorMessage("Failed to authenticate with Discord");
            handleLogout();
        }
    }

    function handleLogout() {
        clearInterval(state.updateInterval);
        state.currentUser = null;
        window.location.hash = "";
        updateUserInterface(null);
    }

    // ======================
    // MODIFIED UI MANAGEMENT
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
                </div>
            `;
        }
        toggleAuthElements(!!user);
    }

    // ======================
    // REMOVED SESSION STORAGE
    // ======================

    // Remove all localStorage references
    // Remove sessionStorage admin auth and use memory only
    let adminAuth = false;

    function authenticateAdmin() {
        if (adminAuth) return true;
        return requestPassword();
    }

    function requestPassword() {
        const password = prompt("🔑 Enter admin password:");
        if (password === "987412365") {
            adminAuth = true;
            alert("✅ Authentication successful!");
            return true;
        }
        alert("❌ Invalid password!");
        return false;
    }

    // ======================
    // OTHER MODIFICATIONS
    // ======================

    // Update handleFormSubmit to clear user on error
    async function handleFormSubmit(event) {
        event.preventDefault();
        clearMessages();

        try {
            if (!state.currentUser) throw new Error("Not authenticated");
            validateSubmissionPrerequisites();
            const formData = gatherFormData();
            await submitApplication(formData);
            
        } catch (error) {
            handleSubmissionError(error);
            handleLogout();
        }
    }

    // Update status display colors
    function updateStatusDisplay() {
        if (state.lastStatus === "online") {
            elements.statusDisplay.textContent = "✅ Anketos: Atidarytos";
            elements.statusDisplay.style.backgroundColor = "rgba(76, 175, 80, 0.3)";
            elements.statusButton.textContent = "🟢 Uždaryti Anketas";
        } else {
            elements.statusDisplay.textContent = "❌ Anketos: Uždarytos";
            elements.statusDisplay.style.backgroundColor = "rgba(244, 67, 54, 0.3)";
            elements.statusButton.textContent = "🔴 Atidaryti Anketas";
        }
    }
});

// Remove logout button CSS since we're not using it anymore
