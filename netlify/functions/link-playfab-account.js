const cookie = require("cookie");

// VARIABLES DE ENTORNO QUE DEBES CONFIGURAR EN NETLIFY
const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REDIRECT_URI = process.env.REDIRECT_URI; // La URL de esta misma función

exports.handler = async function(event) {
    const queryParams = event.queryStringParameters;

    // Parte 2: Google nos devuelve al usuario con un código
    if (queryParams && queryParams.code) {
        const serverAuthCode = queryParams.code;
        const cookies = cookie.parse(event.headers.cookie || "");
        const deviceId = cookies.deviceId;

        if (!deviceId) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: "<h1>Error</h1><p>No se encontró el ID del dispositivo. Por favor, intenta el proceso de nuevo desde el juego.</p>"
            };
        }

        try {
            // Login en PlayFab con el deviceId
            const loginResponse = await fetch(`https://${PLAYFAB_TITLE_ID}.playfabapi.com/Client/LoginWithCustomID`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ TitleId: PLAYFAB_TITLE_ID, CustomId: deviceId, CreateAccount: true })
            });
            const loginData = await loginResponse.json();
            if (!loginResponse.ok) throw new Error(`Error en el login de PlayFab: ${JSON.stringify(loginData)}`);
            
            const sessionTicket = loginData.data.SessionTicket;

            // Vincular la cuenta de Google
            const linkResponse = await fetch(`https://${PLAYFAB_TITLE_ID}.playfabapi.com/Client/LinkGoogleAccount`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Authorization": sessionTicket },
                body: JSON.stringify({ ServerAuthCode: serverAuthCode, ForceLink: true })
            });
            const linkData = await linkResponse.json();
            if (!linkResponse.ok) throw new Error(`Error al vincular la cuenta de Google: ${JSON.stringify(linkData)}`);

            // Mostrar página de éxito
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: "<h1>¡Éxito!</h1><p>Tu cuenta ha sido vinculada correctamente. Ya puedes cerrar esta ventana.</p>"
            };

        } catch (err) {
            console.error("Error en el proceso de vinculación:", err);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: `<h1>Error</h1><p>Ocurrió un problema en el servidor: ${err.message}</p>`
            };
        }
    }

    // Parte 1: El usuario llega desde el juego
    const deviceId = queryParams ? queryParams.deviceId : null;
    if (!deviceId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
            body: "<h1>Error</h1><p>Falta el parámetro 'deviceId' en la URL.</p>"
        };
    }

    // Guardamos el deviceId en una cookie y redirigimos a Google
    const deviceIdCookie = cookie.serialize("deviceId", deviceId, {
        httpOnly: true, path: "/", maxAge: 60 * 5 // 5 minutos
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${REDIRECT_URI}` +
        `&response_type=code` +
        `&scope=email profile` +
        `&access_type=offline`;

    return {
        statusCode: 302, // Redirección
        headers: { "Location": googleAuthUrl, "Set-Cookie": deviceIdCookie }
    };
};
