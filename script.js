document.addEventListener("DOMContentLoaded", async function () {
    console.log("✅ DOM fully loaded!");

    // Configuration
    const CONFIG = {
        SUPABASE: {
            URL: "https://smodsdsnswwtnbnmzhse.supabase.co",
            KEY: "your-anon-key-here"  // Replace with your actual anon key
        },
        DISCORD: {
            CLIENT_ID: "1263389179249692693",
            REDIRECT_URI: "https://anketa.mielamalonu.xyz",
            SCOPES: ["identify", "guilds.members.read"],
            WEBHOOK_URL: "https://discord.com/api/webhooks/1346529699081490472/k-O-v4wKDiUjsj1w-Achvrej1Kr-W-rXqZVibcftwWFn5sMZyhIMSb9E4r975HbQI3tF",
            GUILD_ID: "1325850250027597845"
        }
    };

    // Initialize Supabase
    const supabase = createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.KEY);

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
        currentUser: null, // Modified: Memory-only Discord auth
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
            // Fetch status from Supabase (replace 'SystemStatus' with your table name)
            const { data, error } = await supabase
                .from('SystemStatus')  // Your status table
                .select('*')
                .single();  // Assuming you're storing a single record for status

            if (error) throw error;
            
            updateApplicationState(data); 
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

        const submitButton = event.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = "Pateikiama...";

        try {
            await validateUserRole(); // Check role before proceeding
            validateSubmissionPrerequisites();
            const formData = gatherFormData();
            await submitApplication(formData);

            submitButton.textContent = "Pateikta!";
            setTimeout(() => {
                submitButton.textContent = "Pateikti";
                submitButton.disabled = false;
            }, 3000);

        } catch (error) {
            handleSubmissionError(error);
            submitButton.textContent = "Bandykite dar kartą";
            setTimeout(() => {
                submitButton.textContent = "Pateikti";
                submitButton.disabled = false;
            }, 3000);
        }
    }

    // ======================
    // ADMIN FUNCTIONS
    // ======================

    async function addToBlacklist() {
        if (!authenticateAdmin()) return;

        const newId = prompt("🚫 Enter User ID to blacklist:");
        if (!newId || state.blacklist.includes(newId)) {
            alert(`⚠️ User ID "${newId}" is invalid or already blacklisted.`);
            return;
        }

        state.blacklist.push(newId);
        await updateStatusInSupabase();
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
        await updateStatusInSupabase();
        alert(`✅ User ID "${idToRemove}" has been removed.`);
    }

    async function updateStatusInSupabase() {
        try {
            // Update the status and blacklist in Supabase
            const { error } = await supabase
                .from('SystemStatus')  // Replace with your table name
                .upsert([{
                    id: 1,  // Assuming you are using a single row with ID 1 for SystemStatus
                    status: state.lastStatus,
                    blacklist: state.blacklist
                }]);

            if (error) throw error;
            console.log("✅ Supabase updated successfully");
        } catch (error) {
            console.error("❌ Error updating Supabase:", error);
            throw error;
        }
    }

    function authenticateAdmin() {
        if (sessionStorage.getItem("adminAuth") === "true") return true;
        return requestPassword();
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
    // UI MANAGEMENT
    // ======================

    function updateStatusDisplay() {
        if (state.lastStatus === "online") {
            elements.statusDisplay.textContent = "✅ Atidaryta ✅";
            elements.statusDisplay.className = "status-online";
            elements.statusButton.textContent = "🟢 Uždaryti Anketas";
        } else {
            elements.statusDisplay.textContent = "❌ Uždaryta ❌";
            elements.statusDisplay.className = "status-offline";
            elements.statusButton.textContent = "🔴 Atidaryti Anketas";
        }
    }

    async function toggleApplicationStatus() {
        if (!authenticateAdmin()) return;
        const newStatus = state.lastStatus === "online" ? "offline" : "online";
        state.lastStatus = newStatus;
        await updateStatusInSupabase();
        updateStatusDisplay();
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
        } catch (error) {
            showErrorMessage("Failed to authenticate with Discord");
        }
    }

    // ======================
    // DISCORD FUNCTIONS (MODIFIED)
    // ======================

    async function fetchDiscordUser(token) {
        try {
            const response = await fetch("https://discord.com/api/users/@me", {
                headers: { Authorization: `Bearer ${token}` }
            });

            const user = await response.json();
            return user;
        } catch (error) {
            console.error("Discord API error:", error);
            return {};
        }
    }

    // ======================
    // MESSAGE FUNCTIONS
    // ======================

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
});
