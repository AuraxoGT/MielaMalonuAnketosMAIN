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
        responseMessage: document.createElement("p"),
        submitButton: document.getElementById("submitButton")
    };

    // State Management
    let state = {
        blacklist: '',
        lastStatus: null,
        currentUser: null,
        isSubmitting: false,
        lastSubmissionTime: 0,
        isButtonLoading: false
    };

    // Prevent default behaviors on input fields
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

    // Restore Form Data from Local Storage
    function restoreFormData() {
        const savedFormData = JSON.parse(localStorage.getItem('formData') || '{}');
        const formFields = ['age', 'whyJoin', 'pl', 'kl', 'pc', 'isp'];
        
        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field && savedFormData[fieldId]) {
                field.value = savedFormData[fieldId];
            }
        });
    }

    // Save Form Data to Local Storage
    function saveFormData() {
        const formData = {
            age: document.getElementById('age').value,
            whyJoin: document.getElementById('whyJoin').value,
            pl: document.getElementById('pl').value,
            kl: document.getElementById('kl').value,
            pc: document.getElementById('pc').value,
            isp: document.getElementById('isp').value
        };
        localStorage.setItem('formData', JSON.stringify(formData));
    }

    // Clear Saved Form Data
    function clearSavedFormData() {
        localStorage.removeItem('formData');
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
            
            // Fetch blacklist
            const { data: blacklistData, error: blacklistError } = await supabaseClient
                .from(CONFIG.SUPABASE.BLACKLIST_TABLE)
                .select('*')
                .eq('id', 1)
                .single();
            
            if (blacklistError) throw new Error("Failed to fetch blacklist");
            
            // Update state
            state.lastStatus = statusData.status;
            state.blacklist = blacklistData.blacklisted_ids || '';

            // Update UI
            updateStatusDisplay();
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

    // Check if user is blacklisted
    function isUserBlacklisted(userId) {
        if (!state.blacklist) return false;
        
        const userIdStr = String(userId).trim();
        const blacklistedIds = state.blacklist.split(',').map(id => id.trim());
        
        return blacklistedIds.includes(userIdStr);
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
            // Clear saved form data on submission attempt
            clearSavedFormData();

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
            
            // Reset form
            elements.form.reset();

        } catch (error) {
            handleSubmissionError(error);
        } finally {
            state.isSubmitting = false;
            
            // Remove loading animation
            if (elements.submitButton) {
                elements.submitButton.classList.remove('button-loading');
                state.isButtonLoading = false;
            }
        }
    }

    // Handle Authentication Redirect
    async function handleAuthRedirect() {
        // Get token from URL
        const token = new URLSearchParams(window.location.hash.substring(1)).get("access_token");
        
        if (!token) return;

        try {
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

            // Only validate and submit if on the application page
            if (window.location.pathname.includes('application')) {
                // Validate form first
                if (validateForm()) {
                    // Add loading to button
                    if (elements.submitButton) {
                        elements.submitButton.classList.add('button-loading');
                        state.isButtonLoading = true;
                    }

                    // Submit application
                    await submitApplication();
                }
            }

        } catch (error) {
            console.error("Authentication or submission error:", error);
            showErrorMessage("Nepavyko pateikti anketos. Bandykite dar kartą.");
        } finally {
            // Remove loading state
            if (elements.submitButton) {
                elements.submitButton.classList.remove('button-loading');
                state.isButtonLoading = false;
            }
        }
    }

    // Initiate Discord Authentication
    function handleDiscordAuth() {
        const authUrl = new URL("https://discord.com/api/oauth2/authorize");
        authUrl.searchParams.append("client_id", CONFIG.DISCORD.CLIENT_ID);
        authUrl.searchParams.append("redirect_uri", CONFIG.DISCORD.REDIRECT_URI);
        authUrl.searchParams.append("response_type", "token");
        authUrl.searchParams.append("scope", CONFIG.DISCORD.SCOPES.join(" "));
        window.location.href = authUrl.toString();
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

            // Add loading state to button
            if (elements.submitButton) {
                elements.submitButton.classList.add('button-loading');
                state.isButtonLoading = true;
            }

            // Save form data
            saveFormData();

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
        
        // Reset button loading state
        if (elements.submitButton) {
            elements.submitButton.classList.remove('button-loading');
            state.isButtonLoading = false;
        }

        switch(error.message) {
            case "LA":
                showErrorMessage("❌ Jūs jau esate užpildęs anketą!");
                break;
            default:
                showErrorMessage("❌ Įvyko klaida pateikiant anketą. Bandykite dar kartą.");
        }
    }

    // Initialize
    async function initializePage() {
        try {
            setupInputProtection();
            await fetchStatus();
            
            // Only handle redirect if on application page
            if (window.location.pathname.includes('application')) {
                handleAuthRedirect();
                restoreFormData();
                setupFormSubmission();
            }
        } catch (error) {
            console.error("Initialization error:", error);
            showErrorMessage("Nepavyko inicijuoti puslapio.");
        }
    }

    // Start initialization
    initializePage();
});
