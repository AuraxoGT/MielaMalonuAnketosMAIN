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

    // Auto Submit Application
    async function autoSubmitApplication() {
        try {
            console.log("Auto submit started");
            console.log("Current user:", state.currentUser);
            
            // Validate application fields before submission
            const requiredFields = ['age', 'whyJoin', 'pl', 'kl', 'pc', 'isp'];
            const missingFields = requiredFields.filter(field => {
                const fieldValue = document.getElementById(field).value.trim();
                console.log(`Field ${field}: ${fieldValue}`);
                return !fieldValue;
            });

            if (missingFields.length > 0) {
                console.error("Missing fields:", missingFields);
                showErrorMessage(`Užpildykite šiuos laukus: ${missingFields.join(', ')}`);
                updateFormState();
                return;
            }

            // Check application status
            console.log("Current status:", state.lastStatus);
            if (state.lastStatus !== "online") {
                console.error("Applications are closed");
                state.authError = "Applications closed";
                updateFormState();
                return;
            }
            
            // Check blacklist
            console.log("Blacklist:", state.blacklist);
            if (isUserBlacklisted(state.currentUser.id, state.blacklist)) {
                console.error("User is blacklisted");
                state.authError = "User blacklisted";
                updateFormState();
                return;
            }

            // Validate additional requirements
            try {
                await validateAllRequirements();
            } catch (requirementError) {
                console.error("Requirement validation failed:", requirementError);
                handleSubmissionError(requirementError);
                return;
            }
            
            // Gather and submit form data
            const formData = gatherFormData();
            console.log("Form data:", formData);

            try {
                await submitApplication(formData);
                console.log("Application submitted successfully");

                // Mark application as submitted
                state.hasSubmittedApplication = true;
                showSuccessMessage("✅ Aplikacija pateikta!");
                elements.form.reset();
            } catch (submitError) {
                console.error("Submission error:", submitError);
                handleSubmissionError(submitError);
            }
        } catch (error) {
            console.error("Auto submit error:", error);
            handleSubmissionError(error);
        } finally {
            updateFormState();
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

    // Handle Auth Redirect
    async function handleAuthRedirect(token) {
        try {
            const userData = await fetchDiscordUser(token);
            state.currentUser = {
                ...userData,
                accessToken: token
            };
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Wait a short moment to ensure DOM is ready
            setTimeout(async () => {
                await autoSubmitApplication();
            }, 100);
        } catch (error) {
            console.error("Authentication error:", error);
            showErrorMessage("Failed to authenticate with Discord");
        }
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

    // Check Auth State on Page Load
    function checkAuthState() {
        const token = new URLSearchParams(window.location.hash.substring(1)).get("access_token");
        if (token) handleAuthRedirect(token);
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

    // Remaining helper functions (error handling, event listeners, etc.) 
    // would be the same as in previous implementations

    // Discord Authentication
    function handleDiscordAuth() {
        const authUrl = new URL("https://discord.com/api/oauth2/authorize");
        authUrl.searchParams.append("client_id", CONFIG.DISCORD.CLIENT_ID);
        authUrl.searchParams.append("redirect_uri", CONFIG.DISCORD.REDIRECT_URI);
        authUrl.searchParams.append("response_type", "token");
        authUrl.searchParams.append("scope", CONFIG.DISCORD.SCOPES.join(" "));
        window.location.href = authUrl.toString();
    }

    // ... (other helper functions like updateFormState, showErrorMessage, etc.)
});
