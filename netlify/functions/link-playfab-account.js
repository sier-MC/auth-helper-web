// Archivo: netlify/functions/link-playfab-account.js
// VERSIÓN CORREGIDA

// La forma correcta de importar el SDK de PlayFab en Node.js
var PlayFab = require('playfab-sdk');
var PlayFabServer = PlayFab.PlayFabServer;

// Configura tus claves de PlayFab (las coge de Netlify)
const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;
const PLAYFAB_SECRET_KEY = process.env.PLAYFAB_SECRET_KEY;

// La forma correcta de configurar las claves
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
    
    // Usamos LoginWithCustomID porque el DeviceID que nos llega del cliente es, en efecto, un CustomID para el servidor.
    const loginRequest = {
        TitleId: PLAYFAB_TITLE_ID,
        CustomId: deviceId, 
        CreateAccount: false 
    };

    try {
        const loginResponse = await new Promise((resolve, reject) => {
            PlayFabServer.LoginWithCustomID(loginRequest, (result, error) => {
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
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.errorMessage || "An unknown server error occurred." })
        };
    }
};
