'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');
const { safeStorage, app } = require('electron');

const DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube';

function tokenFilePath() {
  return path.join(app.getPath('userData'), 'youtube-token.enc');
}

function postForm(url, form) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(form).toString();
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function saveTokens(tokens) {
  const plain = JSON.stringify(tokens);
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(plain) : Buffer.from(plain, 'utf8');
  fs.writeFileSync(tokenFilePath(), data);
}

function loadTokens() {
  try {
    const data = fs.readFileSync(tokenFilePath());
    const plain = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(data) : data.toString('utf8');
    return JSON.parse(plain);
  } catch {
    return null;
  }
}

function clearTokens() {
  try { fs.unlinkSync(tokenFilePath()); } catch { /* nothing to clear */ }
}

class YouTubeAuth {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  isConfigured() { return !!(this.clientId && this.clientSecret); }

  hasSession() { return !!loadTokens(); }

  // Device flow: onPrompt receives { verificationUrl, userCode, expiresIn } to show the
  // user, then this resolves once they've approved on google.com/device (or rejects on
  // denial/timeout). No embedded browser or local redirect server needed.
  async signIn(onPrompt) {
    const { body: device } = await postForm(DEVICE_CODE_URL, {
      client_id: this.clientId,
      scope: SCOPES,
    });
    if (!device.device_code) throw new Error(device.error_description || 'Could not start sign-in');

    onPrompt({
      verificationUrl: device.verification_url,
      userCode: device.user_code,
      expiresIn: device.expires_in,
    });

    const intervalMs = (device.interval || 5) * 1000;
    const deadline = Date.now() + device.expires_in * 1000;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, intervalMs));
      const { body } = await postForm(TOKEN_URL, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        device_code: device.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });
      if (body.access_token) {
        saveTokens({
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          expires_at: Date.now() + body.expires_in * 1000,
        });
        return true;
      }
      if (body.error === 'authorization_pending') continue;
      if (body.error === 'slow_down') { await new Promise((r) => setTimeout(r, intervalMs)); continue; }
      throw new Error(body.error_description || body.error || 'Sign-in failed');
    }
    throw new Error('Sign-in timed out — the code expired before it was approved');
  }

  async getAccessToken() {
    const tokens = loadTokens();
    if (!tokens) throw new Error('Not signed in to YouTube');
    if (tokens.expires_at > Date.now() + 30000) return tokens.access_token;

    const { body } = await postForm(TOKEN_URL, {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    });
    if (!body.access_token) throw new Error(body.error_description || 'YouTube session expired — please sign in again');
    const next = { ...tokens, access_token: body.access_token, expires_at: Date.now() + body.expires_in * 1000 };
    saveTokens(next);
    return next.access_token;
  }

  signOut() { clearTokens(); }
}

module.exports = { YouTubeAuth };
