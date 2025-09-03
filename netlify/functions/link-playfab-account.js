var PlayFab = require('playfab-sdk');
var PlayFabClient = PlayFab.PlayFabClient;

const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;

PlayFabClient.settings.titleId = PLAYFAB_TITLE_ID;

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { serverAuthCode, deviceId } = JSON.parse(event.body);

    if (!serverAuthCode || !deviceId) {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: "Missing serverAuthCode or deviceId." }) };
    }

    try {
        // PASO 1: Login con Google (CLIENT API)
        const googleLoginRequest = {
            TitleId: PLAYFAB_TITLE_ID,
            ServerAuthCode: serverAuthCode,
            CreateAccount: true
        };

        const loginResponse = await new Promise((resolve, reject) => {
            PlayFabClient.LoginWithGoogleAccount(googleLoginRequest, (result, error) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        const playFabId = loginResponse.data.PlayFabId;
        const sessionTicket = loginResponse.data.SessionTicket;

        // Guardar el SessionTicket en el cliente SDK
        PlayFabClient.settings.sessionTicket = sessionTicket;

        // PASO 2: Vincular AndroidDeviceID a esa cuenta
        const linkRequest = {
            AndroidDeviceId: deviceId,
            ForceLink: true
        };

        await new Promise((resolve, reject) => {
            PlayFabClient.LinkAndroidDeviceID(linkRequest, (result, error) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, playFabId })
        };

    } catch (error) {
        console.error("PlayFab API call failed:", JSON.stringify(error, null, 2));
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.errorMessage || "Unknown error." })
        };
    }
};
