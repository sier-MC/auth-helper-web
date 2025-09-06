// Archivo: netlify/functions/link-playfab-account.js
const PlayFab = require("playfab-sdk/Scripts/PlayFab/PlayFab.js");
const PlayFabServer = require("playfab-sdk/Scripts/PlayFab/PlayFabServer.js");

const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;
const PLAYFAB_SECRET_KEY = process.env.PLAYFAB_SECRET_KEY;

PlayFab.PlayFabServer.settings.titleId = PLAYFAB_TITLE_ID;
PlayFab.PlayFabServer.settings.developerSecretKey = PLAYFAB_SECRET_KEY;

exports.handler = async function(event, context) {
    console.log("=== Nueva llamada link-playfab-account ===");

    if (event.httpMethod !== 'POST') {
        console.log("Método inválido:", event.httpMethod);
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let serverAuthCode, deviceId;
    try {
        ({ serverAuthCode, deviceId } = JSON.parse(event.body));
    } catch (err) {
        console.error("Error parseando body:", err);
        return { statusCode: 400, body: JSON.stringify({ success: false, error: "Invalid JSON" }) };
    }

    console.log("Body recibido:", { serverAuthCode, deviceId });

    if (!serverAuthCode || !deviceId) {
        console.error("Faltan parámetros");
        return {
            statusCode: 400,
            body: JSON.stringify({ success: false, error: "Missing serverAuthCode or deviceId." })
        };
    }

    const loginRequest = {
        TitleId: PLAYFAB_TITLE_ID,
        CustomId: deviceId,
        CreateAccount: true
    };

    try {
        console.log("➡️ Haciendo LoginWithCustomID en PlayFab...");
        const loginResponse = await new Promise((resolve, reject) => {
            PlayFab.PlayFabServer.LoginWithCustomID(loginRequest, (result, error) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        console.log("✅ Login OK:", loginResponse.data.PlayFabId);
        const playFabId = loginResponse.data.PlayFabId;

        const linkRequest = {
            PlayFabId: playFabId,
            ServerAuthCode: serverAuthCode,
            ForceLink: true
        };

        console.log("➡️ Vinculando cuenta Google...");
        await new Promise((resolve, reject) => {
            PlayFab.PlayFabServer.LinkGoogleAccount(linkRequest, (result, error) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        console.log("✅ Vinculación exitosa!");
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        console.error("❌ Error en el proceso:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.errorMessage || JSON.stringify(error) || "An unknown error occurred."
            })
        };
    }
};
