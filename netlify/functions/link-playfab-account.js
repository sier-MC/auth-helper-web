// Archivo: netlify/functions/link-playfab-account.js
// VERSIÓN FINAL CON LÓGICA INVERTIDA

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

    try {
        // PASO 1: Iniciar sesión con Google para crear/obtener la cuenta maestra.
        const googleLoginRequest = {
            TitleId: PLAYFAB_TITLE_ID,
            ServerAuthCode: serverAuthCode,
            CreateAccount: true
        };

        const loginResponse = await new Promise((resolve, reject) => {
            PlayFabServer.LoginWithGoogleAccount(googleLoginRequest, (result, error) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        const playFabId = loginResponse.data.PlayFabId;
        const sessionTicket = loginResponse.data.SessionTicket;

        // PASO 2: Vincular el DeviceID a la cuenta maestra recién logueada.
        const linkRequest = {
            PlayFabId: playFabId,
            AndroidDeviceId: deviceId,
            ForceLink: true
        };
        
        // Para esta llamada, necesitamos autenticarnos como el propio jugador
        // usando el SessionTicket que acabamos de obtener.
        const customPlayFabClient = {
            settings: {
                titleId: PLAYFAB_TITLE_ID
            },
            ClientApi: PlayFab.PlayFabClient
        };
        
        await new Promise((resolve, reject) => {
            customPlayFabClient.ClientApi.LinkAndroidDeviceID(linkRequest, {
                "X-Authorization": sessionTicket
            }, (result, error) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, playFabId: playFabId })
        };

    } catch (error) {
        console.error("PlayFab API call failed:", JSON.stringify(error, null, 2));
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.errorMessage || "An unknown server error occurred." })
        };
    }
};
