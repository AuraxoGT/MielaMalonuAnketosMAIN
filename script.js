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
            REDIRECT_URI: "https://anketa.mielamalonu.com",
            SCOPES: ["identify", "guilds.members.read"],
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
        responseMessage: document.createElement("p")
    };

    // State Management
    let state = {
        blacklist: '',
        lastStatus: null,
        currentUser: null,
        isSubmitting: false,
        authError: null,
        hasSubmittedApplication: false
    };

    // Initialize
    elements.form.appendChild(elements.responseMessage);
    initializeEventListeners();
    setInterval(fetchStatus, 5000);
    await initializeDatabase();
    fetchStatus();
    checkAuthState();

    // Fetch Discord Invite
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

    // Call Discord invite function
    fetchDiscordInvite("mielamalonu", "rules-container");

    // Helper function to check if a user is blacklisted
    function isUserBlacklisted(userId, blacklistString) {
        if (!blacklistString || blacklistString.trim() === '') {
            return false;
        }
        
        const userIdStr = String(userId).trim();
        const blacklistedIds = blacklistString.split(',').map(id => id.trim());
        
        return blacklistedIds.includes(userIdStr);
    }

    // Database Initialization
    async function initializeDatabase() {
        try {
            // Check and initialize status table
            const { data: statusData, error: statusError } = await supabaseClient
                .from(CONFIG.SUPABASE.STATUS_TABLE)
                .select('*')
                .eq('id', 1);
            
            if (statusError) throw new Error("Failed to check status table");
            
            if (!statusData || statusData.length === 0) {
                console.log("Creating initial status record...");
                const { error: insertError } = await supabaseClient
                    .from(CONFIG.SUPABASE.STATUS_TABLE)
                    .insert({ id: 1, status: 'online' });
                
                if (insertError) throw new Error("Failed to create status record");
            }
            
            // Check and initialize blacklist table
            const { data: blData, error: blError } = await supabaseClient
                .from(CONFIG.SUPABASE.BLACKLIST_TABLE)
                .select('*')
                .eq('id', 1);
            
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

    // Fetch Status and Blacklist
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
            
            // Ensure status is valid
            let currentStatus = statusData.status;
            if (currentStatus !== "online" && currentStatus !== "offline") {
                currentStatus = "online";
                await supabaseClient
                    .from(CONFIG.SUPABASE.STATUS_TABLE)
                    .update({ status: currentStatus })
                    .eq('id', 1);
            }
            
            // Fetch blacklist
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
                } else if (blacklistData.blacklisted_ids !== null && blacklistData.blacklisted_ids !== undefined) {
                    blacklistedIds = String(blacklistData.blacklisted_ids);
                }
            }
            
            // Update application state
            state.lastStatus = currentStatus;
            state.blacklist = blacklistedIds;
            updateStatusDisplay();
            updateFormState();
        } catch (error) {
            console.error("❌ Status fetch error:", error);
            showErrorMessage("Failed to load application status. Check console for details.");
        }
    }

    // Validate Additional Requirements
    async function validateAllRequirements() {
        try {
            const response = await fetch("https://mmapi-production.up.railway.app/api/check-role", {
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

    // Gather Form Data
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

    // Submit Application
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

        const response = await fetch("https://proxy-zzi2.onrender.com/send-to-botghost", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "ef0576a7eb018e3d7cb3a7d4564069245fa8a9fb2b4dd74b5bd3d20c19983041"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("BotGhost API error");
    }

    // Discord Authentication
    function handleDiscordAuth() {
        const authUrl = new URL("https://discord.com/api/oauth2/authorize");
        authUrl.searchParams.append("client_id", CONFIG.DISCORD.CLIENT_ID);
        authUrl.searchParams.append("redirect_uri", CONFIG.DISCORD.REDIRECT_URI);
        authUrl.searchParams.append("response_type", "token");
        authUrl.searchParams.append("scope", CONFIG.DISCORD.SCOPES.join(" "));
        window.location.href = authUrl.toString();
    }

    // Fetch Discord User
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
                avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
            };

        } catch (error) {
            console.error("Discord API error:", error);
            throw error;
        }
    }

    // Auto Submit Application
    async function autoSubmitApplication() {
        try {
            // Validate application fields before submission
            const requiredFields = ['age', 'whyJoin', 'pl', 'kl', 'pc', 'isp'];
            const missingFields = requiredFields.filter(field => 
                !document.getElementById(field).value.trim()
            );

            if (missingFields.length > 0) {
                showErrorMessage(`Užpildykite šiuos laukus: ${missingFields.join(', ')}`);
                updateFormState();
                return;
            }

            // Check application status and blacklist
            if (state.lastStatus !== "online") {
                state.authError = "Applications closed";
                updateFormState();
                return;
            }
            
            if (isUserBlacklisted(state.currentUser.id, state.blacklist)) {
                state.authError = "User blacklisted";
                updateFormState();
                return;
            }

            // Validate additional requirements
            await validateAllRequirements();
            
            // Gather and submit form data
            const formData = gatherFormData();
            await submitApplication(formData);

            // Mark application as submitted
            state.hasSubmittedApplication = true;
            showSuccessMessage("✅ Aplikacija pateikta!");
            elements.form.reset();
        } catch (error) {
            handleSubmissionError(error);
        } finally {
            updateFormState();
        }
    }

    // Form State Update
    function updateFormState() {
        if (!elements.form) return;
        
        const submitBtn = elements.form.querySelector('button[type="submit"]');
        if (!submitBtn) return;
        
        // Determine button text and state based on authentication and errors
        if (!state.currentUser) {
            submitBtn.textContent = "Prisijungti per Discord";
            submitBtn.disabled = false;
            clearMessages();
        } else {
            if (state.hasSubmittedApplication) {
                submitBtn.textContent = "Pateikėte anketą";
                submitBtn.disabled = true;
            } else {
                submitBtn.textContent = "Pateikti";
                
                // Handle specific error states after authentication
                if (state.authError === "Applications closed") {
                    showErrorMessage("❌ Aplikacijos šiuo metu nepriimamos!");
                    submitBtn.disabled = true;
                } else if (state.authError === "User blacklisted") {
                    showErrorMessage("🚫 Jūs esate užblokuotas ir negalite pateikti anketos!");
                    submitBtn.disabled = true;
                } else {
                    submitBtn.disabled = false;
                    clearMessages();
                }
            }
        }
    }

    // Form Submit Handler
    async function handleFormSubmit(event) {
        event.preventDefault();
        
        // Reset previous auth error
        state.authError = null;
        
        // If not logged in, initiate Discord login
        if (!state.currentUser) {
            handleDiscordAuth();
            return;
        }
        
        // If already submitted, do nothing
        if (state.hasSubmittedApplication) {
            return;
        }
        
        // Existing submission logic
        if (state.isSubmitting) return;
        state.isSubmitting = true;
        
        clearMessages();

        const submitButton = event.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = "Pateikiama...";

        try {
            // Validate additional requirements
            await validateAllRequirements();
            
            // If validation passes, gather data and submit
            const formData = gatherFormData();
            await submitApplication(formData);

            // Mark application as submitted
            state.hasSubmittedApplication = true;
            submitButton.textContent = "Pateikėte anketą";
            showSuccessMessage("✅ Aplikacija pateikta!");
            elements.form.reset();
            
        } catch (error) {
            handleSubmissionError(error);
            submitButton.textContent = "Bandykite dar kartą";
        } finally {
            // Reset submission state after delay
            setTimeout(() => {
                state.isSubmitting = false;
                updateFormState();
            }, 3000);
        }
    }

    // Handle Auth Redirect
    async function handleAuthRedirect(token) {
        try {
            const userData = await fetchDiscordUser(token);
            state.currentUser = {
                ...userData,
                accessToken: token
            };
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Automatically submit the application after successful authentication
            await autoSubmitApplication();
        } catch (error) {
            showErrorMessage("Failed to authenticate with Discord");
        }
    }

    // Check Auth State on Page Load
    function checkAuthState() {
        const token = new URLSearchParams(window.location.hash.substring(1)).get("access_token");
        if (token) handleAuthRedirect(token);
    }

    // Status Display Update
    function updateStatusDisplay() {
        if (state.lastStatus === "online") {
            elements.statusDisplay.textContent = "✅ Atidaryta ✅";
            elements.statusDisplay.className = "status-online";
        } else {
            elements.statusDisplay.textContent = "❌ Uždaryta ❌";
            elements.statusDisplay.className = "status-offline";
        }
    }

    // Error Handling
    function handleSubmissionError(error) {
        console.error("Submission error:", error);
        switch(error.message) {
            case "LA":
                showErrorMessage("❌ Jūs jau esate užpildęs anketą!");
                break;
            default:
                showErrorMessage("❌ Įvyko klaida pateikiant anketą. Bandykite dar kartą.");
        }
    }

    // Message Handling
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

    // Event Listeners
    function initializeEventListeners() {
        elements.form.addEventListener("submit", handleFormSubmit);
    }
});
