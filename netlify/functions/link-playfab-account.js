// netlify/functions/link-playfab-account.js

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (err) {
        console.error("Invalid JSON body:", event.body);
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
    }

    const { deviceId, serverAuthCode } = body;

    console.log("DEBUG parsed body:", body);

    if (!deviceId || !serverAuthCode) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing deviceId or serverAuthCode" })
        };
    }

    try {
        // PASO 1: login con AndroidDeviceID
        const loginResponse = await fetch(
            `https://${PLAYFAB_TITLE_ID}.playfabapi.com/Client/LoginWithAndroidDeviceID`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    TitleId: PLAYFAB_TITLE_ID,
                    AndroidDeviceId: deviceId,
                    CreateAccount: true
                })
            }
        );

        const loginData = await loginResponse.json();
        console.log("DEBUG LoginWithAndroidDeviceID response:", loginData);

        if (!loginResponse.ok || !loginData.data?.SessionTicket) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "LoginWithAndroidDeviceID failed", details: loginData })
            };
        }

        const sessionTicket = loginData.data.SessionTicket;

        // PASO 2: link con Google
        const linkResponse = await fetch(
            `https://${PLAYFAB_TITLE_ID}.playfabapi.com/Client/LinkGoogleAccount`,
            {
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
        console.log("DEBUG LinkGoogleAccount response:", linkData);

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
