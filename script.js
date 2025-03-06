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
    
    // NEW: Log Out Button (ensure you have it in your HTML)
    const logoutButton = document.getElementById("logoutButton");

    // Discord OAuth Integration
    const clientId = "1263389179249692693";  // Replace with your Discord Client ID
    const redirectUri = "https://auraxogt.github.io/mmwebtest/";    // Replace with your OAuth Redirect URL
    const scope = "identify";
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;

    // Global variables
    let blacklist = [];
    let lastStatus = null;

    // --- Fetch Status and Blacklist from JSONBin ---
    async function fetchStatus() {
        try {
            const response = await fetch("https://api.jsonbin.io/v3/b/67c851f6e41b4d34e4a1358b", {
                headers: { "X-Master-Key": "$2a$10$Fhj82wgpsjkF/dgzbqlWN.bvyoK3jeIBkbQm9o/SSzDo9pxNryLi." }
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

    // --- Toggle Status (Now actually toggles the status) ---
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
            await fetch("https://api.jsonbin.io/v3/b/67c851f6e41b4d34e4a1358b", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-Master-Key": "$2a$10$Fhj82wgpsjkF/dgzbqlWN.bvyoK3jeIBkbQm9o/SSzDo9pxNryLi."
                },
                body: JSON.stringify({ status: newStatus, blacklist })
            });
            console.log("✅ Data updated successfully in JSONBin.");
        } catch (error) {
            console.error("❌ Error updating JSONBin:", error);
        }
    }

    // --- Original Form Submission (with Discord integration) ---
    form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (lastStatus === "offline") {
            responseMessage.innerText = "❌ Anketos šiuo metu uždarytos.";
            responseMessage.style.color = "red";
            return;
        }

        // Instead of using the username field directly, we now fetch the authenticated user's Discord ID.
        let discordId;
        if (localStorage.getItem("discordUser")) {
            discordId = JSON.parse(localStorage.getItem("discordUser")).discordID;
        } else {
            discordId = document.getElementById("username").value.trim();
        }

        if (blacklist.includes(discordId)) {
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

        console.log("✅ Form submitted with data:", { discordId, age, reason, pl, kl, pc, isp });

        const payload = {
            embeds: [
                {
                    title: "📢 Nauja Aplikacija!",
                    color: 0,
                    fields: [
                        { name: "👤 Asmuo", value: `<@${discordId}>`, inline: true },
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

    // --- Add original event listeners for admin functions ---
    statusButton.addEventListener("click", toggleStatus);
    blacklistButton.addEventListener("click", addToBlacklist);
    removeButton.addEventListener("click", removeFromBlacklist);

    // --- Load initial status ---
    fetchStatus();

    // --- OAuth2 Login Button ---
    const loginButton = document.getElementById("loginButton");
    if (loginButton) {
        loginButton.addEventListener("click", function () {
            window.location.href = authUrl;
        });
    }

    // --- Discord OAuth Integration ---
    function getDiscordUserData(code) {
        fetch(`/get-discord-data?code=${code}`)
            .then(response => response.json())
            .then(data => {
                if (data && data.discordID) {
                    document.getElementById("username").value = data.discordID;
                    document.getElementById("statusDisplay").innerHTML = `✅ Authorized as ${data.discordID}`;
                    document.getElementById("statusDisplay").classList.remove("status-offline");
                    document.getElementById("statusDisplay").classList.add("status-online");
                    localStorage.setItem("discordUser", JSON.stringify(data));
                } else {
                    document.getElementById("statusDisplay").innerHTML = "❌ Authorization failed";
                }
            })
            .catch(error => console.error("Error fetching Discord user data:", error));
    }

    function handleOAuthRedirect() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            getDiscordUserData(code);
        }
    }

    if (window.location.search.includes('code=')) {
        handleOAuthRedirect();
    }

    // --- Log Out functionality ---
    if (logoutButton) {
        logoutButton.addEventListener("click", function () {
            localStorage.removeItem("discordUser");
            document.getElementById("username").value = "";
            document.getElementById("statusDisplay").innerHTML = "❌ Not Authorized";
            document.getElementById("statusDisplay").classList.remove("status-online");
            document.getElementById("statusDisplay").classList.add("status-offline");
            window.location.href = authUrl;
        });
    }
});
