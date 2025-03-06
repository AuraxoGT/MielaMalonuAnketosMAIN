const clientId = "1263389179249692693"; // Replace with your Discord Client ID
const redirectUri = encodeURIComponent("https://mielamalonu.xyz"); // Replace with your actual redirect URL
const authEndpoint = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=identify`;

let discordUser = null; // Store authenticated user data
let isApplicationsOpen = false; // Default status
const blacklist = new Set(); // Store blacklisted users

document.addEventListener("DOMContentLoaded", async function () {
    // Handle Discord OAuth2 authentication
    const fragment = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = fragment.get("access_token");

    if (accessToken) {
        fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` }
        })
        .then(response => response.json())
        .then(user => {
            discordUser = user; // Store user data

            // Hide login button and show user info
            document.getElementById("discordLogin").style.display = "none";
            document.getElementById("discordProfile").innerHTML = `
                <div class="discord-widget">
                    <img src="https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png" alt="Avatar" class="discord-avatar">
                    <p>${user.username}#${user.discriminator} (<span id="discordID">${user.id}</span>)</p>
                </div>
            `;

            // Auto-fill the Discord ID field
            document.getElementById("username").value = user.id;
            document.getElementById("username").readOnly = true; // Prevent manual change
        })
        .catch(console.error);
    } else {
        document.getElementById("discordLogin").addEventListener("click", () => {
            window.location.href = authEndpoint;
        });
    }

    // Status Control Button
    const statusButton = document.getElementById("statusButton");
    statusButton.addEventListener("click", function () {
        isApplicationsOpen = !isApplicationsOpen;
        const statusDisplay = document.getElementById("statusDisplay");
        if (isApplicationsOpen) {
            statusDisplay.textContent = "✅ Anketos: Atidarytos";
            statusDisplay.classList.remove("status-offline");
            statusDisplay.classList.add("status-online");
        } else {
            statusDisplay.textContent = "❌ Anketos: Uždarytos";
            statusDisplay.classList.remove("status-online");
            statusDisplay.classList.add("status-offline");
        }
    });

    // Blacklist Button
    document.getElementById("blacklistButton").addEventListener("click", function () {
        const userId = prompt("Įveskite Discord ID, kurį norite pridėti į Blacklist:");
        if (userId) {
            blacklist.add(userId);
            alert(`🚫 Vartotojas ${userId} pridėtas į Blacklist!`);
        }
    });

    // Remove from Blacklist Button
    document.getElementById("removeButton").addEventListener("click", function () {
        const userId = prompt("Įveskite Discord ID, kurį norite pašalinti iš Blacklist:");
        if (userId && blacklist.has(userId)) {
            blacklist.delete(userId);
            alert(`✅ Vartotojas ${userId} pašalintas iš Blacklist!`);
        } else {
            alert("❌ Vartotojas nerastas Blacklist'e!");
        }
    });

    // Handle form submission
    document.getElementById("applicationForm").addEventListener("submit", function (event) {
        event.preventDefault(); // Prevent default form submission

        if (!discordUser) {
            alert("❌ Prašome prisijungti per Discord prieš pateikdami formą!");
            return;
        }

        if (!isApplicationsOpen) {
            alert("🚫 Anketos šiuo metu uždarytos!");
            return;
        }

        if (blacklist.has(discordUser.id)) {
            alert("❌ Jūs esate Blacklist'e ir negalite pateikti anketos!");
            return;
        }

        const formData = {
            discordID: discordUser.id, // Get Discord ID from OAuth2
            username: `${discordUser.username}#${discordUser.discriminator}`,
            age: document.getElementById("age").value,
            pl: document.getElementById("pl").value,
            kl: document.getElementById("kl").value,
            whyJoin: document.getElementById("whyJoin").value,
            pc: document.getElementById("pc").value,
            isp: document.getElementById("isp").value,
        };

        // Send data to Discord Webhook
        fetch("https://canary.discord.com/api/webhooks/1346529699081490472/k-O-v4wKDiUjsj1w-Achvrej1Kr-W-rXqZVibcftwWFn5sMZyhIMSb9E4r975HbQI3tF", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                embeds: [{
                    title: "📄 Nauja Anketa",
                    color: 5763719,
                    fields: [
                        { name: "👤 Vartotojas", value: `${formData.username} (<@${formData.discordID}>)`, inline: false },
                        { name: "🎂 Amžius", value: formData.age, inline: true },
                        { name: "🎯 Pašaudimo Lygis", value: formData.pl, inline: true },
                        { name: "💬 Komunikacijos Lygis", value: formData.kl, inline: true },
                        { name: "🤔 Kodėl nori prisijungti?", value: formData.whyJoin, inline: false },
                        { name: "🖥️ PC Check", value: formData.pc, inline: false },
                        { name: "⚠️ Išpirkimas", value: formData.isp, inline: false },
                    ],
                    footer: { text: "Miela Malonu Aplikacija", icon_url: "https://i.imgur.com/amma0ov.gif" }
                }]
            })
        })
        .then(response => {
            if (response.ok) {
                alert("✅ Jūsų aplikacija pateikta sėkmingai!");
                document.getElementById("applicationForm").reset();
            } else {
                alert("❌ Klaida siunčiant duomenis!");
            }
        })
        .catch(error => console.error("❌ Klaida:", error));
    });
});
