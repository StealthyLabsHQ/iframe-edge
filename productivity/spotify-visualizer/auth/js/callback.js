/* callback.js — Spotify PKCE token exchange */
(function () {
    'use strict';

    const REDIRECT_URI = 'https://stealthylabshq.github.io/iframe-edge/productivity/spotify-visualizer/auth/callback.html';

    function setStatus(iconChar, iconClass, title, subtitle) {
        const icon = document.getElementById('icon');
        icon.textContent = iconChar;
        icon.className = 'step-icon ' + iconClass;
        document.getElementById('title').textContent = title;
        document.getElementById('subtitle').textContent = subtitle;
    }

    async function run() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const error = params.get('error');

        if (error) {
            setStatus('✗', 'error', 'Authorization denied', 'You cancelled the authorization or an error occurred: ' + error);
            return;
        }

        if (!code) {
            setStatus('✗', 'error', 'No code received', 'Spotify did not return an authorization code. Please try again from the widget.');
            return;
        }

        const verifier = sessionStorage.getItem('pkce_verifier');
        const clientId = sessionStorage.getItem('pkce_client_id');

        if (!verifier || !clientId) {
            setStatus('✗', 'error', 'Session expired', 'Could not find the code verifier. Please start the authorization flow again from the widget.');
            return;
        }

        try {
            const resp = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: REDIRECT_URI,
                    client_id: clientId,
                    code_verifier: verifier,
                }),
            });

            const data = await resp.json();

            if (!resp.ok || !data.refresh_token) {
                throw new Error(data.error_description || data.error || 'Unknown error from Spotify');
            }

            sessionStorage.removeItem('pkce_verifier');
            sessionStorage.removeItem('pkce_client_id');

            setStatus('✓', 'success', 'Authorization successful!', 'Copy your refresh token below and paste it into the widget settings.');
            document.getElementById('tokenText').textContent = data.refresh_token;
            document.getElementById('tokenSection').style.display = 'block';

        } catch (err) {
            setStatus('✗', 'error', 'Token exchange failed', err.message || 'An unexpected error occurred. Please try again.');
        }
    }

    document.getElementById('copyBtn').addEventListener('click', function () {
        const token = document.getElementById('tokenText').textContent;
        if (!token) return;
        navigator.clipboard.writeText(token).then(() => {
            this.textContent = 'Copied!';
            this.classList.add('copied');
            setTimeout(() => {
                this.textContent = 'Copy';
                this.classList.remove('copied');
            }, 2500);
        });
    });

    run();
})();
