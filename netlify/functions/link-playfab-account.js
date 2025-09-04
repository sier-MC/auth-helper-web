// Archivo: netlify/functions/link-playfab-account.js
const PlayFab = require("playfab-sdk/Scripts/PlayFab/PlayFab.js");
const PlayFabServer = require("playfab-sdk/Scripts/PlayFab/PlayFabServer.js");

// Configura tus claves de PlayFab (las pondremos en Netlify más tarde)
const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;
const PLAYFAB_SECRET_KEY = process.env.PLAYFAB_SECRET_KEY;

PlayFab.PlayFabServer.settings.titleId = PLAYFAB_TITLE_ID;
PlayFab.PlayFabServer.settings.developerSecretKey = PLAYFAB_SECRET_KEY;

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { serverAuthCode, deviceId } = JSON.parse(event.body);

    if (!serverAuthCode || !deviceId) {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: "Missing serverAuthCode or deviceId." }) };
    }
    
    // Usaremos CustomId para el login del servidor, es más genérico
    const loginRequest = {
        TitleId: PLAYFAB_TITLE_ID,
        CustomId: deviceId, 
        CreateAccount: false 
    };

    try {
        const loginResponse = await new Promise((resolve, reject) => {
            PlayFab.PlayFabServer.LoginWithCustomID(loginRequest, (result, error) => {
                if (error) reject(error);
                else resolve(result);
            });
        });
        
        const playFabId = loginResponse.data.PlayFabId;

        // Vincular la cuenta de Google a ese PlayFabID
        const linkRequest = {
            PlayFabId: playFabId,
            ServerAuthCode: serverAuthCode,
            ForceLink: true
        };

        await new Promise((resolve, reject) => {
            PlayFab.PlayFabServer.LinkGoogleAccount(linkRequest, (result, error) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.errorMessage || "An unknown error occurred." })
        };
    }
};
