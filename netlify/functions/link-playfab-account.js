// link-playfab-account.js

const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;

exports.handler = async function(event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { sessionTicket, serverAuthCode } = JSON.parse(event.body);

    if (!sessionTicket || !serverAuthCode) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing sessionTicket or serverAuthCode" })
        };
    }

    try {
        const response = await fetch(
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

        const data = await response.json();
        console.log("LinkGoogleAccount raw response:", data);

        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({ success: false, error: data })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, result: data })
        };

    } catch (err) {
        console.error("Unexpected error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: err.message })
        };
    }
};
