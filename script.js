document.addEventListener("DOMContentLoaded", async function () {
    console.log("✅ DOM fully loaded!");

    // Configuration
    const CONFIG = {
        SUPABASE: {
            URL: "https://your-supabase-url.supabase.co", // Replace with your Supabase URL
            KEY: "your-anon-key" // Replace with your Supabase anon key
        },
        DISCORD: {
            CLIENT_ID: "1263389179249692693",
            REDIRECT_URI: "https://anketa.mielamalonu.xyz",
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
            const { data, error } = await supabase
                .from('your_table') // Replace 'your_table' with your actual table name
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
            throw error; // Prevents form submission
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
            console.error("BotGhost webhook error:", error);
            showErrorMessage("❌ Nepavyko išsiųsti aplikacijos, bandykite dar kartą. Jei nepavyks, susisiekite su AuraxoGT.");
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
        await updateSupabase();
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
        await updateSupabase();
        alert(`✅ User ID "${idToRemove}" has been removed.`);
    }

    async function updateSupabase() {
        try {
            const { error } = await supabase
                .from('your_table') // Replace 'your_table' with your actual table name
                .upsert({ 
                    status: state.lastStatus,
                    blacklist: state.blacklist
                });

            if (error) throw error;
            console.log("✅ Supabase updated successfully");
        } catch (error) {
            console.error("❌ Supabase update error:", error);
            throw error;
        }
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
            const userData = await fetchDiscordUserData(token);
            state.currentUser = userData;
            updateUserInterface(state.currentUser);
            window.location.hash = "";  // Clear the token
        } catch (error) {
            console.error("Discord auth error:", error);
        }
    }

    async function fetchDiscordUserData(token) {
        const response = await fetch(`https://discord.com/api/v10/users/@me`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();
        return data;
    }

    function updateUserInterface(user) {
        if (user) {
            elements.discordButton.style.display = "none";
            elements.profileContainer.style.display = "block";
            elements.profileContainer.innerHTML = `Welcome, ${user.username}`;
        } else {
            elements.discordButton.style.display = "block";
            elements.profileContainer.style.display = "none";
        }
    }

    function showErrorMessage(message) {
        elements.responseMessage.textContent = message;
        elements.responseMessage.style.color = "red";
    }

    function showSuccessMessage(message) {
        elements.responseMessage.textContent = message;
        elements.responseMessage.style.color = "green";
    }

    function clearMessages() {
        elements.responseMessage.textContent = "";
    }

    function authenticateAdmin() {
        const isAdmin = state.currentUser && state.currentUser.id === "YOUR_ADMIN_ID";  // Replace with actual admin ID
        if (!isAdmin) {
            alert("You are not authorized to perform this action.");
        }
        return isAdmin;
    }
});
