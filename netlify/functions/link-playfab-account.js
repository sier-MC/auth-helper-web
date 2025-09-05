const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;

exports.handler = async function(event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { deviceId, serverAuthCode } = JSON.parse(event.body);
    console.log("DEBUG parsed body:", { deviceId, serverAuthCode });

    if (!deviceId || !serverAuthCode) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing deviceId or serverAuthCode" })
        };
    }

    try {
        // Paso 1: Login con AndroidDeviceID
        const loginPayload = {
            TitleId: PLAYFAB_TITLE_ID,
            AndroidDeviceId: String(deviceId),
            CreateAccount: true
        };
        console.log("DEBUG loginPayload:", loginPayload);

        const loginResponse = await fetch(
            `https://${PLAYFAB_TITLE_ID}.playfabapi.com/Client/LoginWithAndroidDeviceID`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(loginPayload)
            }
        );

        const loginData = await loginResponse.json();
        console.log("DEBUG loginData:", loginData);

        if (!loginResponse.ok || !loginData.data?.SessionTicket) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Failed to login", details: loginData })
            };
        }

        const sessionTicket = loginData.data.SessionTicket;

        // Paso 2: Link Google
        const linkPayload = {
            ServerAuthCode: serverAuthCode,
            ForceLink: true
        };
        console.log("DEBUG linkPayload:", linkPayload);

        const linkResponse = await fetch(
            `https://${PLAYFAB_TITLE_ID}.playfabapi.com/Client/LinkGoogleAccount`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Authorization": sessionTicket
                },
                body: JSON.stringify(linkPayload)
            }
        );

        const linkData = await linkResponse.json();
        console.log("DEBUG linkData:", linkData);

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
