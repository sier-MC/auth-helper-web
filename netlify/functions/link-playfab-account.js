const cookie = require("cookie");

// VARIABLES DE ENTORNO
const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REDIRECT_URI = process.env.REDIRECT_URI; // La URL de esta misma función

exports.handler = async function(event) {
    const queryParams = event.queryStringParameters;

    // --- Parte 2: Google nos devuelve al usuario con un código ---
    if (queryParams && queryParams.code) {
        const serverAuthCode = queryParams.code;

        try {
            // CAMBIO PRINCIPAL: Usamos LoginWithGoogleAccount directamente
            const loginResponse = await fetch(`https://${PLAYFAB_TITLE_ID}.playfabapi.com/Client/LoginWithGoogleAccount`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    TitleId: PLAYFAB_TITLE_ID,
                    ServerAuthCode: serverAuthCode,
                    CreateAccount: true // Crea una cuenta si no existe
                })
            });
            const loginData = await loginResponse.json();
            if (!loginResponse.ok) throw new Error(`Error en el login/vinculación con Google: ${JSON.stringify(loginData)}`);

            // Si llegamos aquí, ¡éxito!
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: "<h1>¡Éxito!</h1><p>Has iniciado sesión correctamente. Ya puedes cerrar esta ventana.</p>"
            };

        } catch (err) {
            console.error("Error en el proceso de login con Google:", err);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: `<h1>Error</h1><p>Ocurrió un problema en el servidor: ${err.message}</p>`
            };
        }
    }

    // --- Parte 1: El usuario llega desde el juego ---
    // Ya no necesitamos el deviceId, pero el flujo de redirección es el mismo
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${REDIRECT_URI}` +
        `&response_type=code` +
        `&scope=email profile` +
        `&access_type=offline`;

    return {
        statusCode: 302, // Redirección
        headers: { "Location": googleAuthUrl }
    };
};
