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
        currentUser: null
    };

    // Initialize
    elements.form.appendChild(elements.responseMessage);
    initializeEventListeners();
    checkAuthState();
    setInterval(fetchStatus, 5000);
    fetchStatus();

    // ======================
    // CORE FUNCTIONALITY
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
    // FORM SUBMISSION
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
            color: 0x2B2D31,
            fields: [
                { name: "👤 Asmuo", value: sanitizeInput(`<@${data.userId}>`), inline: true },
                { name: "🎂 Metai", value: sanitizeInput(data.age), inline: true },
                { name: "📝 Priežastis", value: sanitizeInput(data.reason), inline: true },
                { name: "🔫 Pašaudymas", value: sanitizeInput(`${data.pl}/10`), inline: true },
                { name: "📞 Komunikacija", value: sanitizeInput(`${data.kl}/10`), inline: true },
                { name: "🖥️ PC Check", value: sanitizeInput(data.pc), inline: true },
                { name: "🚫 Ispėjimai", value: sanitizeInput(data.isp), inline: true }
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

    // ======================
    // UI MANAGEMENT
    // ======================

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

    function updateStatusDisplay() {
        if (state.lastStatus === "online") {
            elements.statusDisplay.textContent = "✅ Anketos: Atidarytos";
            elements.statusDisplay.className = "status-online";
            elements.statusButton.textContent = "🟢 Uždaryti Anketas";
        } else {
            elements.statusDisplay.textContent = "❌ Anketos: Uždarytos";
            elements.statusDisplay.className = "status-offline";
            elements.statusButton.textContent = "🔴 Atidaryti Anketas";
        }
    }

    function toggleAuthElements(authenticated) {
        elements.profileContainer.style.display = authenticated ? "flex" : "none";
        elements.discordButton.style.display = authenticated ? "none" : "block";
    }

    // ======================
    // ADMIN FUNCTIONALITY
    // ======================

    async function toggleApplicationStatus() {
        if (!authenticateAdmin()) return;
        const newStatus = state.lastStatus === "online" ? "offline" : "online";
        await updateServerStatus(newStatus);
    }

    async function addToBlacklist() {
        if (!authenticateAdmin()) return;
        
        const newId = prompt("🚫 Enter User ID to blacklist:");
        if (!newId || state.blacklist.includes(newId)) {
            alert(`⚠️ User ID "${newId}" is invalid or already blacklisted.`);
            return;
        }

        state.blacklist.push(newId);
        await updateJSONBin();
        alert(`✅ User ID "${newId}" has been blacklisted.`);
    }

    async function removeFromBlacklist() {
        if (!authenticateAdmin()) return;

        const idToRemove = prompt("❌ Enter User ID to remove from blacklist:");
        if (!idToRemove || !state.blacklist.includes(idToRemove)) {
            alert(`⚠️ User ID "${idToRemove}" is not in the blacklist.`);
            return;
        }

        state.blacklist = state.blacklist.filter(id => id !== idToRemove);
        await updateJSONBin();
        alert(`✅ User ID "${idToRemove}" has been removed.`);
    }

    function authenticateAdmin() {
        if (sessionStorage.getItem("adminAuth") === "true") return true;
        requestPassword();
        return false;
    }

    function requestPassword() {
        const password = prompt("🔑 Enter admin password:");
        if (password === "987412365") {
            sessionStorage.setItem("adminAuth", "true");
            alert("✅ Authentication successful!");
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

    function handleLogout() {
        localStorage.removeItem("discord_user");
        state.currentUser = null;
        updateUserInterface(null);
        location.reload();
    }

    async function updateServerStatus(newStatus) {
        try {
            state.lastStatus = newStatus;
            await updateJSONBin(newStatus);
            updateStatusDisplay();
        } catch (error) {
            console.error("Status update failed:", error);
            showErrorMessage("Failed to update application status");
        }
    }

    async function updateJSONBin(newStatus = state.lastStatus) {
        try {
            await fetch(CONFIG.JSONBIN.URL, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-Master-Key": CONFIG.JSONBIN.KEY,
                },
                body: JSON.stringify({ 
                    status: newStatus, 
                    blacklist: state.blacklist 
                })
            });
            console.log("✅ JSONBin updated successfully");
        } catch (error) {
            console.error("❌ JSONBin update error:", error);
            throw error;
        }
    }

    function sanitizeInput(input) {
        return String(input)
            .substring(0, 1024)
            .replace(/[@#`*_~]/g, "");
    }

    function showSuccessMessage(message) {
        elements.responseMessage.textContent = message;
        elements.responseMessage.style.color = "green";
    }

    function showErrorMessage(message) {
        elements.responseMessage.textContent = message;
        elements.responseMessage.style.color = "red";
    }

    function clearMessages() {
        elements.responseMessage.textContent = "";
    }

    function handleSubmissionError(error) {
        console.error("Submission error:", error);
        const message = {
            "Not authenticated": "❌ Turite prisijungti su Discord prieš pateikiant!",
            "Applications closed": "❌ Anketos šiuo metu uždarytos.",
            "User blacklisted": "🚫 Jūs esate užblokuotas ir negalite pateikti anketos!",
        }[error.message] || "❌ Nepavyko išsiųsti aplikacijos.";
        
        showErrorMessage(message);
    }
});
