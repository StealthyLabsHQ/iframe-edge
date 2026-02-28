/* login.js — Spotify PKCE authorization flow */
(function () {
    'use strict';

    const REDIRECT_URI = 'https://stealthylabshq.github.io/iframe-edge/productivity/spotify-visualizer/auth/callback.html';
    const SCOPES = 'user-read-currently-playing user-read-playback-state user-modify-playback-state';

    function showError(msg) {
        const box = document.getElementById('errorBox');
        box.textContent = msg;
        box.style.display = 'block';
    }

    // Read client_id from URL query param
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('client_id');

    if (!clientId) {
        document.getElementById('authBtn').disabled = true;
        showError('Missing client_id parameter. Please re-open this page from the widget settings.');
    }

    // PKCE helpers
    function generateCodeVerifier(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const arr = new Uint8Array(length);
        crypto.getRandomValues(arr);
        return Array.from(arr).map(b => chars[b % chars.length]).join('');
    }

    async function generateCodeChallenge(verifier) {
        const encoded = new TextEncoder().encode(verifier);
        const hash = await crypto.subtle.digest('SHA-256', encoded);
        return btoa(String.fromCharCode(...new Uint8Array(hash)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    document.getElementById('authBtn').addEventListener('click', async function () {
        if (!clientId) return;

        const verifier = generateCodeVerifier(128);
        const challenge = await generateCodeChallenge(verifier);

        sessionStorage.setItem('pkce_verifier', verifier);
        sessionStorage.setItem('pkce_client_id', clientId);

        const url = new URL('https://accounts.spotify.com/authorize');
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('scope', SCOPES);
        url.searchParams.set('redirect_uri', REDIRECT_URI);
        url.searchParams.set('code_challenge_method', 'S256');
        url.searchParams.set('code_challenge', challenge);
        url.searchParams.set('show_dialog', 'false');

        window.location.href = url.toString();
    });
})();
