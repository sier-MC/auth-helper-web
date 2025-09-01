// Archivo: netlify/functions/link-playfab-account.js
// VERSIÓN FINAL CON EL MÉTODO DE LOGIN CORRECTO

var PlayFab = require('playfab-sdk');
var PlayFabServer = PlayFab.PlayFabServer;

const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;
const PLAYFAB_SECRET_KEY = process.env.PLAYFAB_SECRET_KEY;

PlayFabServer.settings.titleId = PLAYFAB_TITLE_ID;
PlayFabServer.settings.developerSecretKey = PLAYFAB_SECRET_KEY;

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { serverAuthCode, deviceId } = JSON.parse(event.body);

    if (!serverAuthCode || !deviceId) {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: "Missing serverAuthCode or deviceId." }) };
    }
    
    // CAMBIO CLAVE: Usamos LoginWithAndroidDeviceID para ser consistentes con el cliente.
    const loginRequest = {
        TitleId: PLAYFAB_TITLE_ID,
        AndroidDeviceId: deviceId, // <--- CAMBIADO DE CustomId A AndroidDeviceId
        CreateAccount: true
    };

    try {
        const loginResponse = await new Promise((resolve, reject) => {
            // CAMBIADO DE LoginWithCustomID A LoginWithAndroidDeviceID
            PlayFabServer.LoginWithAndroidDeviceID(loginRequest, (result, error) => {
                if (error) reject(error);
                else resolve(result);
            });
        });
        
        const playFabId = loginResponse.data.PlayFabId;

        // Ahora que la sesión es consistente, la vinculación funcionará.
        const linkRequest = {
            PlayFabId: playFabId,
            ServerAuthCode: serverAuthCode,
            ForceLink: true
        };

        await new Promise((resolve, reject) => {
            PlayFabServer.LinkGoogleAccount(linkRequest, (result, error) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        console.error("PlayFab API call failed:", JSON.stringify(error, null, 2));
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.errorMessage || "An unknown server error occurred." })
        };
    }
};
