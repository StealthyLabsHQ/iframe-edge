/* callback.js - Spotify PKCE token exchange */
(function () {
    'use strict';

    const REDIRECT_URI = 'https://stealthylabshq.github.io/iframe-edge/spotify-visualizer/auth/callback.html';
    const OAUTH_STATE_KEY = 'oauth_state';

    function setStatus(iconChar, iconClass, title, subtitle) {
        const icon = document.getElementById('icon');
        icon.textContent = iconChar;
        icon.className = 'step-icon ' + iconClass;
        document.getElementById('title').textContent = title;
        document.getElementById('subtitle').textContent = subtitle;
    }

    function enforceTopLevelWindow() {
        if (window.top === window.self) return true;
        document.body.innerHTML = '';
        return false;
    }

    function clearAuthSession() {
        sessionStorage.removeItem('pkce_verifier');
        sessionStorage.removeItem('pkce_client_id');
        sessionStorage.removeItem(OAUTH_STATE_KEY);
    }

    async function run() {
        if (!enforceTopLevelWindow()) {
            clearAuthSession();
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const error = params.get('error');
        const state = params.get('state');

        // Drop auth params from URL as soon as possible.
        if (window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (error) {
            clearAuthSession();
            setStatus('X', 'error', 'Authorization denied', 'You cancelled the authorization or an error occurred: ' + error);
            return;
        }

        if (!code) {
            clearAuthSession();
            setStatus('X', 'error', 'No code received', 'Spotify did not return an authorization code. Please try again from the widget.');
            return;
        }

        const verifier = sessionStorage.getItem('pkce_verifier');
        const clientId = sessionStorage.getItem('pkce_client_id');
        const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);

        if (!verifier || !clientId || !expectedState) {
            clearAuthSession();
            setStatus('X', 'error', 'Session expired', 'Could not find the code verifier. Please start the authorization flow again from the widget.');
            return;
        }

        if (!state || state !== expectedState) {
            clearAuthSession();
            setStatus('X', 'error', 'Invalid OAuth state', 'Authorization state mismatch. Please restart the authorization flow.');
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

            clearAuthSession();
            setStatus('OK', 'success', 'Authorization successful!', 'Copy your refresh token below and paste it into the widget settings.');
            document.getElementById('tokenText').textContent = data.refresh_token;
            document.getElementById('tokenSection').style.display = 'block';
        } catch (err) {
            clearAuthSession();
            setStatus('X', 'error', 'Token exchange failed', err.message || 'An unexpected error occurred. Please try again.');
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
