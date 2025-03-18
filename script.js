document.addEventListener("DOMContentLoaded", async function () {
    console.log("✅ DOM fully loaded!");

    // Configuration
    const CONFIG = {
        SUPABASE: {
            URL: "https://your-project-url.supabase.co", // Replace with your Supabase URL
            KEY: "your-anon-key-here"  // Replace with your Supabase anon key
        },
        DISCORD: {
            CLIENT_ID: "1263389179249692693",
            REDIRECT_URI: "https://anketa.mielamalonu.xyz",
            SCOPES: ["identify", "guilds.members.read"],
            WEBHOOK_URL: "https://discord.com/api/webhooks/1346529699081490472/k-O-v4wKDiUjsj1w-Achvrej1Kr-W-rXqZVibcftwWFn5sMZyhIMSb9E4r975HbQI3tF",
            GUILD_ID: "1325850250027597845"
        }
    };

    // Supabase Client Setup
    const supabase = supabase.createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.KEY);

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
            const { data, error } = await supabase
                .from('SystemStatus')
                .select('status, blacklist')
                .eq('id', 1)
                .single();
            
            if (error) throw new Error("Failed to fetch status from Supabase");

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
            const user = await fetchDiscordUser(localStorage.getItem('discord-token'));
            if (user) state.currentUser = user;
        } catch (error) {
            console.error("Error updating Discord presence:", error);
        }
    }

    // ======================
    // UI & STATE MANAGEMENT
    // ======================

    function updateStatusDisplay() {
        elements.statusDisplay.textContent = `Status: ${state.lastStatus}`;
        elements.blacklistButton.disabled = state.lastStatus === "offline";
        elements.removeButton.disabled = state.lastStatus !== "offline";
    }

    function clearMessages() {
        elements.responseMessage.textContent = '';
    }

    function showErrorMessage(message) {
        elements.responseMessage.textContent = `❌ ${message}`;
    }

    function showSuccessMessage(message) {
        elements.responseMessage.textContent = `✅ ${message}`;
    }

    // ======================
    // EVENT LISTENERS
    // ======================

    function initializeEventListeners() {
        elements.form.addEventListener("submit", handleFormSubmit);
        elements.discordButton.addEventListener("click", handleDiscordAuth);
    }

    // ======================
    // INITIALIZATION
    // ======================
    async function checkAuthState() {
        const token = localStorage.getItem("discord-token");

        if (token) {
            const user = await fetchDiscordUser(token);
            if (user.id) {
                state.currentUser = user;
                updateStatusDisplay();
                console.log("✅ User authenticated successfully:", user);
            } else {
                console.log("❌ Discord authentication failed");
            }
        }
    }
});
