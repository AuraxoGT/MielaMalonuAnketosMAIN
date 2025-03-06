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

    // JSONBin.io API URL
    const JSONBIN_URL = "https://api.jsonbin.io/v3/b/67c851f6e41b4d34e4a1358b";
    const API_KEY = "$2a$10$Fhj82wgpsjkF/dgzbqlWN.bvyoK3jeIBkbQm9o/SSzDo9pxNryLi.";

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

            // Reload only if status or blacklist has changed
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

    // --- Update Status UI ---
    function updateStatusUI(status) {
        if (status === "online") {
            statusDisplay.textContent = "✅ Anketos: Atidarytos";
            statusDisplay.classList.add("status-online");
            statusDisplay.classList.remove("status-offline");
            statusButton.textContent = "🟢 Uždaryti Anketas";
        } else {
            statusDisplay.textContent = "❌ Anketos: Uždarytos";
            statusDisplay.classList.add("status-offline");
            statusDisplay.classList.remove("status-online");
            statusButton.textContent = "🔴 Atidaryti Anketas";
        }
    }

    // --- Periodic Status Check ---
    setInterval(fetchStatus, 5000); // Check every 5 seconds

    // --- Admin Authentication ---
    function authenticateAdmin() {
        return sessionStorage.getItem("adminAuth") === "true"; // Use sessionStorage (resets on browser close)
    }

    function requestPassword() {
        const password = prompt("🔑 Enter admin password:");
        if (password === "987412365") {
            sessionStorage.setItem("adminAuth", "true"); // Store admin auth in sessionStorage
            alert("✅ Authentication successful!");
        } else {
            alert("❌ Invalid password!");
        }
    }

    // --- Add to Blacklist ---
    async function addToBlacklist() {
        if (!authenticateAdmin()) {
            requestPassword();
            return;
        }

        const newId = prompt("🚫 Enter User ID to blacklist:");
        if (!newId || blacklist.includes(newId)) {
            alert(`⚠️ User ID "${newId}" is invalid or already blacklisted.`);
            return;
        }

        blacklist.push(newId);
        await updateJSONBin();
        alert(`✅ User ID "${newId}" has been blacklisted.`);
    }

    // --- Remove from Blacklist ---
    async function removeFromBlacklist() {
        if (!authenticateAdmin()) {
            requestPassword();
            return;
        }

        const idToRemove = prompt("❌ Enter User ID to remove from blacklist:");
        if (!idToRemove || !blacklist.includes(idToRemove)) {
            alert(`⚠️ User ID "${idToRemove}" is not in the blacklist.`);
            return;
        }

        blacklist = blacklist.filter(id => id !== idToRemove);
        await updateJSONBin();
        alert(`✅ User ID "${idToRemove}" has been removed.`);
    }

    // --- Toggle Status ---
    async function toggleStatus() {
        if (!authenticateAdmin()) {
            requestPassword();
            return;
        }

        const newStatus = statusDisplay.textContent.includes("Uždarytos") ? "online" : "offline";
        await updateJSONBin(newStatus);
        updateStatusUI(newStatus);
    }

    // --- Update JSONBin ---
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

    // --- Form Submission ---
    form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (lastStatus === "offline") {
            responseMessage.innerText = "❌ Anketos šiuo metu uždarytos.";
            responseMessage.style.color = "red";
            return;
        }

        const username = document.getElementById("username").value.trim();
        if (blacklist.includes(username)) {
            responseMessage.innerText = "🚫 Jūs esate užblokuotas ir negalite pateikti anketos!";
            responseMessage.style.color = "red";
            return;
        }

        const age = document.getElementById("age").value.trim();
        const reason = document.getElementById("whyJoin").value.trim();
        const pl = document.getElementById("pl").value.trim();
        const kl = document.getElementById("kl").value.trim();
        const pc = document.getElementById("pc").value.trim();
        const isp = document.getElementById("isp").value.trim();

        console.log("✅ Form submitted with data:", { username, age, reason, pl, kl, pc, isp });

        const payload = {
            embeds: [
                {
                    title: "📢 Nauja Aplikacija!",
                    color: 00000000,
                    fields: [
                        { name: "👤 Asmuo", value: `<@${user.id}>`, inline: true },
                        { name: "🎂 Metai", value: `**${age}**`, inline: true },
                        { name: "📝 Kodėl nori prisijungti?", value: `**${reason}**`, inline: true },
                        { name: "🔫 Pašaudymo lygis", value: `**${pl} / 10**`, inline: true },
                        { name: "📞 Komunikacijos lygis", value: `**${kl} / 10**`, inline: true },
                        { name: "🖥️ PC Check", value: `**${pc}**`, inline: true },
                        { name: "🚫 Ispėjimo išpirkimas", value: `**${isp}**`, inline: true },
                    ],
                    timestamp: new Date().toISOString()
                }
            ]
        };

        fetch("https://canary.discord.com/api/webhooks/1346529699081490472/k-O-v4wKDiUjsj1w-Achvrej1Kr-W-rXqZVibcftwWFn5sMZyhIMSb9E4r975HbQI3tF", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then(response => {
            if (response.ok) {
                responseMessage.innerText = `✅ Aplikacija pateikta!`;
                responseMessage.style.color = "green";
                form.reset();
            } else {
                throw new Error("❌ Failed to send application.");
            }
        }).catch(error => {
            responseMessage.innerText = "❌ Nepavyko išsiųsti aplikacijos.";
            responseMessage.style.color = "red";
        });
    });

    // Add event listeners
    statusButton.addEventListener("click", toggleStatus);
    blacklistButton.addEventListener("click", addToBlacklist);
    removeButton.addEventListener("click", removeFromBlacklist);


document.addEventListener("DOMContentLoaded", function () {
    const CLIENT_ID = "1263389179249692693";
    const REDIRECT_URI = "https://auraxogt.github.io/mmwebtest/";
    const API_ENDPOINT = "https://discord.com/api/oauth2/authorize";
    const USER_URL = "https://discord.com/api/users/@me";

    const discordButton = document.getElementById("discord-login");
    const profileContainer = document.getElementById("profile-container");

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
                <p>${user.username}#${user.discriminator}</p>
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
        const authUrl = `${API_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=identify`;
        window.location.href = authUrl;
    });

    function fetchUser(token) {
        fetch(USER_URL, {
            headers: { Authorization: `Bearer ${token}` },
        })
        .then(res => res.json())
        .then(user => {
            user.avatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
            storeUser(user);
            updateUI(user);
        })
        .catch(err => console.error("Error fetching user:", err));
    }

    if (window.location.hash.includes("access_token")) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        fetchUser(params.get("access_token"));
        window.history.replaceState({}, document.title, "/");
    }

    updateUI(getStoredUser());

    document.querySelector("form").addEventListener("submit", function () {
        const user = getStoredUser();
        if (user) {
            document.getElementById("username").value = user.id;
        }
    });
});


    // Load initial status
    fetchStatus();
});
