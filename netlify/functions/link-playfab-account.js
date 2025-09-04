const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;

exports.handler = async function(event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    let body;
    try {
        body = JSON.parse(event.body);
        console.log("DEBUG parsed body:", body);
    } catch (err) {
        console.error("Error parsing body:", err);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Invalid JSON" })
        };
    }

    // CAMBIO 1: Ahora también esperamos 'platform'
    const { serverAuthCode, deviceId, platform } = body;

    if (!deviceId || !serverAuthCode || !platform) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing deviceId, serverAuthCode, or platform" })
        };
    }

    try {
        let loginEndpoint = "";
        let loginPayload = {};

        // CAMBIO 2: Elegir el endpoint y el payload según la plataforma
        if (platform === 'android') {
            loginEndpoint = `https://${PLAYFAB_TITLE_ID}.playfabapi.com/Client/LoginWithAndroidDeviceID`;
            loginPayload = {
                TitleId: PLAYFAB_TITLE_ID,
                AndroidDeviceId: deviceId,
                CreateAccount: true
            };
        } else if (platform === 'ios') {
            loginEndpoint = `https://${PLAYFAB_TITLE_ID}.playfabapi.com/Client/LoginWithIOSDeviceID`;
            loginPayload = {
                TitleId: PLAYFAB_TITLE_ID,
                DeviceId: deviceId,
                CreateAccount: true
            };
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Unsupported platform. Use 'android' or 'ios'." })
            };
        }

        // --- PASO 1: Login en PlayFab con el método de dispositivo correcto ---
        console.log(`Attempting login for platform: ${platform} with Device ID: ${deviceId}`);
        const loginResponse = await fetch(loginEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loginPayload)
        });

        const loginData = await loginResponse.json();
        
        if (!loginResponse.ok) {
            console.error("PlayFab login failed:", loginData);
            return {
                statusCode: loginResponse.status,
                body: JSON.stringify({ success: false, error: "PlayFab login failed", details: loginData })
            };
        }

        const sessionTicket = loginData.data.SessionTicket;
        console.log("Successfully logged in, got session ticket.");
        
        // --- PASO 2: Vincular cuenta de Google (sin cambios aquí) ---
        console.log("Attempting to link Google Account...");
        const linkResponse = await fetch(
            `https://${PLAYFAB_TITLE_ID}.playfabapi.com/Client/LinkGoogleAccount`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Authorization": sessionTicket
                },
                body: JSON.stringify({
                    ServerAuthCode: serverAuthCode,
                    ForceLink: true
                })
            }
        );

        const linkData = await linkResponse.json();
        console.log("LinkGoogleAccount raw response:", linkData);

        if (!linkResponse.ok) {
            return {
                statusCode: linkResponse.status,
                body: JSON.stringify({ success: false, error: linkData })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, result: linkData })
        };

    } catch (err) {
        console.error("Unexpected error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: err.message })
        };
    }
};
