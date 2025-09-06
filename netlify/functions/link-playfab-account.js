const axios = require('axios');
const PlayFab = require('playfab-sdk');

// VARIABLES DE ENTORNO
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;
const REDIRECT_URI = process.env.REDIRECT_URI; // La URL de esta misma función

exports.handler = async function(event) {
    const queryParams = event.queryStringParameters;

    // --- Parte 1: El usuario llega por primera vez, redirigir a Google ---
    if (!queryParams || !queryParams.code) {
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
        authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('scope', 'email profile');
        authUrl.searchParams.append('access_type', 'offline');
        
        return {
            statusCode: 302,
            headers: { 'Location': authUrl.toString() }
        };
    }

    // --- Parte 2: Google nos devuelve con un código ---
    try {
        // PASO 1: Intercambiar el código por un Access Token con Google
        console.log("Intercambiando código por token...");
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', null, {
            params: {
                code: queryParams.code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
            }
        });

        const accessToken = tokenResponse.data.access_token;
        console.log("Token de acceso obtenido.");

        // PASO 2: Usar el Access Token para hacer login en PlayFab
        console.log("Iniciando sesión en PlayFab con el token de Google...");
        
        // --- CAMBIO AQUÍ ---
        // La configuración se aplica al cliente específico del SDK
        PlayFab.PlayFabClient.settings.titleId = PLAYFAB_TITLE_ID;

        const loginRequest = {
            TitleId: PLAYFAB_TITLE_ID,
            AccessToken: accessToken,
            CreateAccount: true
        };

        const playfabResponse = await new Promise((resolve, reject) => {
            // --- Y CAMBIO AQUÍ ---
            // Usamos PlayFab.PlayFabClient en lugar de PlayFab.Client
            PlayFab.PlayFabClient.LoginWithGoogleAccount(loginRequest, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
        });

        console.log("¡Éxito! Login/vinculación completada.");
        
        // PASO 3: Devolver una página de éxito
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
            body: `<h1>¡Éxito!</h1><p>Tu cuenta ha sido vinculada correctamente. PlayFabID: ${playfabResponse.data.PlayFabId}. Ya puedes cerrar esta ventana.</p>`
        };

    } catch (err) {
        const errorDetails = err.response ? err.response.data : (err.errorMessage || err.message);
        console.error("Error en el proceso:", errorDetails);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
            body: `<h1>Error</h1><p>Ocurrió un problema en el servidor: ${JSON.stringify(errorDetails)}</p>`
        };
    }
};
