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

    // DOM Elements
    const elements = {
        form: document.getElementById("applicationForm"),
        statusDisplay: document.getElementById("statusDisplay"),
        discordButton: document.getElementById("discord-login"),
        profileContainer: document.getElementById("profile-container"),
        submitButton: document.getElementById("submitButton"),
        responseMessage: document.createElement("p")
    };

    // State Management
    let state = {
        blacklist: '',
        lastStatus: null,
        currentUser: null,
        updateInterval: null,
        isSubmitting: false,
        lastSubmissionTime: 0
    };

    // Database Initialization
    async function initializeDatabase() {
        try {
            // Check status table
            const { data: statusData, error: statusError } = await supabaseClient
                .from(CONFIG.SUPABASE.STATUS_TABLE)
                .select('*')
                .eq('id', 1);
            
            if (statusError) throw new Error("Failed to check status table");
            
            if (!statusData || statusData.length === 0) {
                const { error: insertError } = await supabaseClient
                    .from(CONFIG.SUPABASE.STATUS_TABLE)
                    .insert({ id: 1, status: 'online' });
                
                if (insertError) throw new Error("Failed to create status record");
            }
            
            // Check blacklist table
            const { data: blData, error: blError } = await supabaseClient
                .from(CONFIG.SUPABASE.BLACKLIST_TABLE)
                .select('*')
                .eq('id', 1);
            
            if (!blData || blData.length === 0) {
                const { error: blInsertError } = await supabaseClient
                    .from(CONFIG.SUPABASE.BLACKLIST_TABLE)
                    .insert({ id: 1, blacklisted_ids: '' });
                
                if (blInsertError) throw new Error("Failed to initialize blacklist");
            }
        } catch (error) {
            console.error("Database initialization error:", error);
            throw error;
        }
    }

    // Fetch Status 
    async function fetchStatus() {
        try {
            // Fetch application status
            const { data: statusData, error: statusError } = await supabaseClient
                .from(CONFIG.SUPABASE.STATUS_TABLE)
                .select('*')
                .eq('id', 1)
                .single();
            
            if (statusError) throw new Error("Failed to fetch status");
            
            // Ensure valid status
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
            
            if (blacklistError) throw new Error("Failed to fetch blacklist");
            
            // Robust blacklist parsing
            let blacklistedIds = '';
            if (blacklistData && blacklistData.blacklisted_ids) {
                if (typeof blacklistData.blacklisted_ids === 'string') {
                    blacklistedIds = blacklistData.blacklisted_ids;
                } else if (Array.isArray(blacklistData.blacklisted_ids)) {
                    blacklistedIds = blacklistData.blacklisted_ids.join(',');
                } else {
                    blacklistedIds = String(blacklistData.blacklisted_ids);
                }
            }
            
            // Comprehensive state update check
            const statusChanged = state.lastStatus !== currentStatus;
            const blacklistChanged = state.blacklist !== blacklistedIds;
            
            // Update state only if something has changed
            if (statusChanged || blacklistChanged) {
                state.lastStatus = currentStatus;
                state.blacklist = blacklistedIds;
                
                // Update UI components
                updateStatusDisplay();
                updateFormState();
                
                console.log("Status or Blacklist Updated:", {
                    status: currentStatus,
                    blacklist: blacklistedIds
                });
            }
        } catch (error) {
            console.error("❌ Status fetch error:", error);
            showErrorMessage("Failed to load application status.");
        }
    }

    // Update Status Display
    function updateStatusDisplay() {
        if (state.lastStatus === "online") {
            elements.statusDisplay.textContent = "✅ Atidaryta ✅";
            elements.statusDisplay.className = "status-online";
        } else {
            elements.statusDisplay.textContent = "❌ Uždaryta ❌";
            elements.statusDisplay.className = "status-offline";
        }
    }

    // Input Protection
    function setupInputProtection() {
        const inputs = elements.form.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            // Remove any existing event listeners
            const oldInput = input.cloneNode(true);
            input.parentNode.replaceChild(oldInput, input);

            // Add minimal event listener to prevent unwanted submissions
            oldInput.addEventListener('keydown', function(e) {
                // Prevent form submission on Enter key
                if (e.key === 'Enter') {
                    e.preventDefault();
                }
            });
        });
    }

    // Input Validation
    function validateForm() {
        const requiredFields = ['age', 'whyJoin', 'pl', 'kl', 'pc', 'isp'];
        for (let fieldId of requiredFields) {
            const field = document.getElementById(fieldId);
            if (!field || field.value.trim() === '') {
                showErrorMessage(`❌ Prašome užpildyti visus laukus!`);
                return false;
            }
        }
        return true;
    }

    // Check if user is blacklisted
    function isUserBlacklisted(userId) {
        if (!state.blacklist) return false;
        
        const userIdStr = String(userId).trim();
        const blacklistedIds = state.blacklist.split(',').map(id => id.trim());
        
        return blacklistedIds.includes(userIdStr);
    }

    // Update Form State
    function updateFormState() {
        if (!elements.form) return;
        
        const submitBtn = elements.submitButton;
        if (!submitBtn) return;
        
        // Only enable if all conditions are met
        const isLoggedIn = !!state.currentUser;
        const isBlacklisted = isLoggedIn && isUserBlacklisted(state.currentUser.id);
        const isOnline = state.lastStatus === "online";
        
        submitBtn.disabled = !isLoggedIn || isBlacklisted || !isOnline || state.isSubmitting;
        
        // Handle messages
        if (isBlacklisted) {
            showErrorMessage("🚫 Jūs esate užblokuotas ir negalite pateikti anketos!");
        } else if (!isOnline) {
            showErrorMessage("❌ Aplikacijos šiuo metu nepriimamos!");
        } else if (!isLoggedIn) {
            showErrorMessage("❌ Prieš pateikiant anketą, reikia prisijungti!");
        } else {
            clearMessages();
        }
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

    // Check Role Requirement
    async function checkRoleRequirement() {
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

    // Submit Application
    async function submitApplication() {
        if (state.isSubmitting) return;
        state.isSubmitting = true;

        try {
            // Check role requirement
            await checkRoleRequirement();

            // Prepare application data
            const data = {
                userId: state.currentUser.id,
                age: document.getElementById("age").value.trim(),
                reason: document.getElementById("whyJoin").value.trim(),
                pl: document.getElementById("pl").value.trim(),
                kl: document.getElementById("kl").value.trim(),
                pc: document.getElementById("pc").value.trim(),
                isp: document.getElementById("isp").value.trim()
            };

            const appId = `${data.userId.slice(0, 16)}-${Date.now()}`;

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

            // Show success message
            showSuccessMessage("✅ Aplikacija pateikta!");
            
            // Hide submit button
            if (elements.submitButton) {
                elements.submitButton.style.display = 'none';
            }

            // Reset form
            elements.form.reset();

            // Redirect after 5 seconds
            setTimeout(() => {
                window.location.href = "https://anketa.mielamalonu.com";
            }, 5000);

        } catch (error) {
            handleSubmissionError(error);
        } finally {
            state.isSubmitting = false;
        }
    }

    // Handle Authentication Redirect
    async function handleAuthRedirect(token) {
        try {
            // Store token in local storage for potential reuse
            localStorage.setItem('discordToken', token);

            // Fetch user data
            const userData = await fetchDiscordUser(token);
            
            // Check application status
            if (state.lastStatus !== "online") {
                showErrorMessage("❌ Aplikacijos šiuo metu nepriimamos!");
                return;
            }

            // Prevent rapid submissions
            const currentTime = Date.now();
            if (currentTime - state.lastSubmissionTime < 30000) { // 30 seconds cooldown
                showErrorMessage("❌ Palaukite prieš teikdami dar vieną anketą!");
                return;
            }
            state.lastSubmissionTime = currentTime;

            // Check if user is blacklisted
            if (isUserBlacklisted(userData.id)) {
                showErrorMessage("🚫 Jūs esate užblokuotas ir negalite pateikti anketos!");
                return;
            }

            // Set current user
            state.currentUser = {
                ...userData,
                accessToken: token
            };

            // Update form state
            updateFormState();

            // Submit application
            await submitApplication();

        } catch (error) {
            console.error("Authentication or submission error:", error);
            showErrorMessage("Nepavyko pateikti anketos. Bandykite dar kartą.");
            
            // Redirect to main page on error
            window.location.href = "https://anketa.mielamalonu.com";
        }
    }

    // Check Authentication State
    function checkAuthState() {
        const token = new URLSearchParams(window.location.hash.substring(1)).get("access_token") || 
                      localStorage.getItem('discordToken');
        
        if (token) {
            handleAuthRedirect(token);
        }
    }

    // Setup form submission event listener
    function setupFormSubmission() {
        // Remove any existing submit event listeners
        const oldForm = elements.form.cloneNode(true);
        elements.form.parentNode.replaceChild(oldForm, elements.form);

        // Add controlled submit event listener
        oldForm.addEventListener("submit", function(event) {
            // Absolutely prevent default form submission
            event.preventDefault();
            event.stopPropagation();

            // Validate form
            if (!validateForm()) return;

            // Start Discord authentication
            handleDiscordAuth();
        });

        // Update form reference
        elements.form = oldForm;
    }

    // Show Success Message
    function showSuccessMessage(message) {
        elements.responseMessage.textContent = message;
        elements.responseMessage.className = "success-message";
        elements.form.appendChild(elements.responseMessage);
    }

    // Show Error Message
    function showErrorMessage(message) {
        elements.responseMessage.textContent = message;
        elements.responseMessage.className = "error-message";
        elements.form.appendChild(elements.responseMessage);
    }

    // Handle Submission Error
    function handleSubmissionError(error) {
        console.error("Submission error:", error);

        switch(error.message) {
            case "LA":
                showErrorMessage("❌ Jūs jau esate užpildęs anketą!");
                break;
            default:
                showErrorMessage("❌ Įvyko klaida pateikiant anketą. Bandykite dar kartą.");
        }

        // Redirect to main page
        setTimeout(() => {
            window.location.href = "https://anketa.mielamalonu.com";
        }, 5000);
    }

    // Discord Invite Fetcher
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

    // Initialize
    async function initializePage() {
        try {
            setupInputProtection();
            await initializeDatabase();
            await fetchStatus();
            checkAuthState();
            setupFormSubmission();
            
            // Fetch Discord invite for the specified container
            await fetchDiscordInvite("mielamalonu", "rules-container");

            // Start periodic status checking
            setInterval(fetchStatus, 30000); // Check every 30 seconds
        } catch (error) {
            console.error("Initialization error:", error);
            showErrorMessage("Nepavyko inicijuoti puslapio.");
        }
    }

    // Start initialization
    initializePage();
});
