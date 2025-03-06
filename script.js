document.addEventListener("DOMContentLoaded", async function () {
    console.log("✅ DOM fully loaded!");

    // Get elements
    const form = document.getElementById("applicationForm");
    const responseMessage = document.createElement("p");
    form.appendChild(responseMessage);

    const statusButton = document.getElementById("statusButton");
    const statusDisplay = document.getElementById("statusDisplay");
    const blacklistButton = document.getElementById("blacklistButton");
    const removeButton = document.getElementById("removeButton");
    const discordButton = document.getElementById("discord-login");
    const profileContainer = document.getElementById("profile-container");

    // JSONBin.io API URL
    const JSONBIN_URL = "https://api.jsonbin.io/v3/b/67c851f6e41b4d34e4a1358b";
    const API_KEY = "$2a$10$Fhj82wgpsjkF/dgzbqlWN.bvyoK3jeIBkbQm9o/SSzDo9pxNryLi.";

    // Discord Integration
    const CLIENT_ID = "1263389179249692693";
    const REDIRECT_URI = "https://auraxogt.github.io/mmwebtest/";
    const API_ENDPOINT = "https://discord.com/api/oauth2/authorize";
    const USER_URL = "https://discord.com/api/users/@me";

    // Global variables
    let blacklist = [];
    let lastStatus = null;

    // --- Fetch Status and Blacklist from JSONBin ---
    async function fetchStatus() {
        try {
            const response = await fetch(JSONBIN_URL, {
                headers: { "X-Master-Key": API_KEY }
            });
            const data = await response.json();

            console.log("✅ Fetched Data from JSONBin:", data);

            if (lastStatus !== data.record.status || JSON.stringify(blacklist) !== JSON.stringify(data.record.blacklist)) {
                lastStatus = data.record.status;
                blacklist = data.record.blacklist || [];
                updateStatusUI(lastStatus);
                console.log("🔄 Status or blacklist changed. Updating UI...");
            }
        } catch (error) {
            console.error("❌ Error fetching status:", error);
        }
    }

    function updateStatusUI(status) {
        if (status === "online") {
            statusDisplay.textContent = "✅ Anketos: Atidarytos";
            statusButton.textContent = "🟢 Uždaryti Anketas";
        } else {
            statusDisplay.textContent = "❌ Anketos: Uždarytos";
            statusButton.textContent = "🔴 Atidaryti Anketas";
        }
    }

    async function updateJSONBin(newStatus = lastStatus) {
        try {
            await fetch(JSONBIN_URL, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-Master-Key": API_KEY,
                },
                body: JSON.stringify({ status: newStatus, blacklist })
            });
            console.log("✅ Data updated successfully in JSONBin.");
        } catch (error) {
            console.error("❌ Error updating JSONBin:", error);
        }
    }

    function authenticateAdmin() {
        return sessionStorage.getItem("adminAuth") === "true";
    }

    function requestPassword() {
        const password = prompt("🔑 Enter admin password:");
        if (password === "987412365") {
            sessionStorage.setItem("adminAuth", "true");
            alert("✅ Authentication successful!");
        } else {
            alert("❌ Invalid password!");
        }
    }

    async function toggleStatus() {
        if (!authenticateAdmin()) {
            requestPassword();
            return;
        }
        const newStatus = lastStatus === "offline" ? "online" : "offline";
        await updateJSONBin(newStatus);
        updateStatusUI(newStatus);
    }

    function getStoredUser() {
        return JSON.parse(localStorage.getItem("discord_user"));
    }

    function storeUser(user) {
        localStorage.setItem("discord_user", JSON.stringify(user));
    }

    function clearUser() {
        localStorage.removeItem("discord_user");
        location.reload();
    }

    function updateUI(user) {
        if (user) {
            profileContainer.innerHTML = `
                <img src="${user.avatar}" alt="Avatar" width="50">
                <p>${user.username}</p>
                <button id="logout">Log Out</button>
            `;
            profileContainer.style.display = "block";
            discordButton.style.display = "none";
            document.getElementById("logout").addEventListener("click", clearUser);
        } else {
            profileContainer.style.display = "none";
            discordButton.style.display = "block";
        }
    }

    discordButton.addEventListener("click", function () {
        console.log("🔵 Discord login button clicked!");
        const authUrl = `${API_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=identify`;
        window.location.href = authUrl;
    });

    async function fetchUser(token) {
        try {
            const response = await fetch(USER_URL, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const user = await response.json();
            if (!user.id) {
                console.error("Invalid user data:", user);
                return;
            }
            user.avatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
            storeUser(user);
            updateUI(user);
        } catch (error) {
            console.error("❌ Error fetching user:", error);
        }
    }

    function extractTokenFromURL() {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        return params.get("access_token");
    }

    // Initialization
    const token = extractTokenFromURL();
    if (token) {
        fetchUser(token);
        window.history.replaceState({}, document.title, REDIRECT_URI);
    }

    updateUI(getStoredUser());
    statusButton.addEventListener("click", toggleStatus);
    fetchStatus();
    setInterval(fetchStatus, 5000);
});
