const crypto = require('crypto');

/**
 * SSO Service for Multiple Provider Integration
 * Handles OAuth2 Authorization Code flow
 * 
 * Supported Providers:
 * - SIMPATIK (AMDPT SSO API v2.1.0)
 * - Google (OAuth 2.0)
 * - Microsoft (Azure AD OAuth 2.0)
 * - GitHub (OAuth 2.0)
 */
class SsoService {
  constructor() {
    // State store for CSRF protection (in production, use Redis or DB)
    this.stateStore = new Map();
    this.STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

    // Cleanup expired states periodically
    setInterval(() => this._cleanupExpiredStates(), 60 * 1000);
  }

  /**
   * Get SSO provider configuration
   */
  getProviderConfig(provider) {
    const configs = {
      simpatik: {
        name: 'SIMPATIK',
        enabled: process.env.SSO_SIMPATIK_ENABLED === 'true',
        clientId: process.env.SSO_SIMPATIK_CLIENT_ID,
        clientSecret: process.env.SSO_SIMPATIK_CLIENT_SECRET,
        baseUrl: process.env.SSO_SIMPATIK_BASE_URL || 'https://app.maccaqe.id',
        redirectUri: process.env.SSO_SIMPATIK_REDIRECT_URI,
        scopes: (process.env.SSO_SIMPATIK_SCOPES || 'openid profile email').split(' '),
        authorizePath: process.env.SSO_SIMPATIK_AUTHORIZE_PATH || '/api/v1/sso/authorize',
        tokenPath: process.env.SSO_SIMPATIK_TOKEN_PATH || '/api/v1/sso/token',
        userInfoPath: process.env.SSO_SIMPATIK_USERINFO_PATH || '/api/v1/sso/userinfo',
        tokenContentType: 'json' // SIMPATIK uses JSON
      },
      google: {
        name: 'Google',
        enabled: process.env.SSO_GOOGLE_ENABLED === 'true',
        clientId: process.env.SSO_GOOGLE_CLIENT_ID,
        clientSecret: process.env.SSO_GOOGLE_CLIENT_SECRET,
        baseUrl: 'https://accounts.google.com',
        redirectUri: process.env.SSO_GOOGLE_REDIRECT_URI,
        scopes: ['openid', 'email', 'profile'],
        authorizePath: '/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
        tokenContentType: 'form',
        useResponseType: true,
        useScopeParam: true
      },
      microsoft: {
        name: 'Microsoft',
        enabled: process.env.SSO_MICROSOFT_ENABLED === 'true',
        clientId: process.env.SSO_MICROSOFT_CLIENT_ID,
        clientSecret: process.env.SSO_MICROSOFT_CLIENT_SECRET,
        tenant: process.env.SSO_MICROSOFT_TENANT || 'common',
        get baseUrl() { return `https://login.microsoftonline.com/${this.tenant}`; },
        redirectUri: process.env.SSO_MICROSOFT_REDIRECT_URI,
        scopes: ['openid', 'email', 'profile', 'User.Read'],
        authorizePath: '/oauth2/v2.0/authorize',
        tokenPath: '/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        tokenContentType: 'form',
        useResponseType: true,
        useScopeParam: true
      },
      github: {
        name: 'GitHub',
        enabled: process.env.SSO_GITHUB_ENABLED === 'true',
        clientId: process.env.SSO_GITHUB_CLIENT_ID,
        clientSecret: process.env.SSO_GITHUB_CLIENT_SECRET,
        baseUrl: 'https://github.com',
        redirectUri: process.env.SSO_GITHUB_REDIRECT_URI,
        scopes: ['read:user', 'user:email'],
        authorizePath: '/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        emailsUrl: 'https://api.github.com/user/emails',
        tokenContentType: 'form',
        useScopeParam: true
      }
    };

    const config = configs[provider];
    if (!config) {
      throw new Error(`Unknown SSO provider: ${provider}`);
    }

    return config;
  }

  /**
   * Check if SSO provider is enabled and properly configured
   */
  isProviderEnabled(provider) {
    try {
      const config = this.getProviderConfig(provider);
      return config.enabled && config.clientId && config.clientSecret && config.redirectUri;
    } catch {
      return false;
    }
  }

  /**
   * Generate a secure random state for CSRF protection
   */
  generateState() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Store state with metadata for validation
   */
  storeState(state, metadata = {}) {
    this.stateStore.set(state, {
      ...metadata,
      createdAt: Date.now()
    });
  }

  /**
   * Validate and consume state (one-time use)
   */
  validateState(state) {
    const stored = this.stateStore.get(state);
    if (!stored) {
      return null;
    }

    // Check expiry
    if (Date.now() - stored.createdAt > this.STATE_TTL_MS) {
      this.stateStore.delete(state);
      return null;
    }

    // Consume state (one-time use)
    this.stateStore.delete(state);
    return stored;
  }

  /**
   * Cleanup expired states
   */
  _cleanupExpiredStates() {
    const now = Date.now();
    for (const [state, data] of this.stateStore.entries()) {
      if (now - data.createdAt > this.STATE_TTL_MS) {
        this.stateStore.delete(state);
      }
    }
  }

  /**
   * Build authorization URL for SSO provider
   * @param {string} provider - Provider name
   * @param {string} state - CSRF state token
   * @param {string} returnUrl - URL to return after SSO (stored in state metadata)
   */
  buildAuthorizationUrl(provider, state, returnUrl = null) {
    const config = this.getProviderConfig(provider);

    if (!config.enabled) {
      throw new Error(`SSO provider ${provider} is not enabled`);
    }

    // Store state with metadata
    this.storeState(state, { provider, returnUrl });

    // Build URL with query parameters
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state: state
    });

    // Add response_type for OAuth2 providers that need it
    if (config.useResponseType) {
      params.append('response_type', 'code');
    }

    // Add scope for providers that need it
    if (config.useScopeParam && config.scopes) {
      params.append('scope', config.scopes.join(' '));
    }

    return `${config.baseUrl}${config.authorizePath}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} provider - Provider name
   * @param {string} code - Authorization code from callback
   */
  async exchangeCodeForToken(provider, code) {
    const config = this.getProviderConfig(provider);
    const tokenUrl = config.tokenUrl || `${config.baseUrl}${config.tokenPath}`;

    const bodyData = {
      code: code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code'
    };

    console.log(`[SSO:${provider}] Token exchange URL: ${tokenUrl}`);

    try {
      let response;
      
      if (config.tokenContentType === 'json') {
        // JSON format (SIMPATIK)
        response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(bodyData)
        });
      } else {
        // Form-urlencoded format (Google, Microsoft, GitHub)
        const params = new URLSearchParams();
        Object.entries(bodyData).forEach(([key, value]) => {
          params.append(key, value);
        });

        response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: params.toString()
        });
      }

      console.log(`[SSO:${provider}] Token response status: ${response.status}`);

      const responseText = await response.text();
      
      if (!response.ok) {
        console.error(`[SSO:${provider}] Token exchange failed: ${response.status} ${responseText}`);
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        // GitHub might return form-urlencoded
        if (responseText.includes('access_token=')) {
          data = Object.fromEntries(new URLSearchParams(responseText));
        } else {
          console.error(`[SSO:${provider}] Failed to parse token response: ${responseText}`);
          throw new Error('Invalid response from token endpoint');
        }
      }

      console.log(`[SSO:${provider}] Token exchange success, got access_token: ${data.access_token ? 'yes' : 'no'}`);

      if (!data.access_token) {
        throw new Error('No access token in response');
      }

      return {
        accessToken: data.access_token,
        tokenType: data.token_type || 'Bearer',
        expiresIn: data.expires_in,
        refreshToken: data.refresh_token || null,
        idToken: data.id_token || null,
        scope: data.scope || null,
        user: data.user || null // SIMPATIK returns user directly
      };
    } catch (error) {
      console.error(`[SSO:${provider}] Token exchange error:`, error);
      throw new Error(`Failed to exchange code for token: ${error.message}`);
    }
  }

  /**
   * Fetch user info from SSO provider
   * @param {string} provider - Provider name
   * @param {string} accessToken - Access token
   */
  async getUserInfo(provider, accessToken) {
    const config = this.getProviderConfig(provider);
    const userInfoUrl = config.userInfoUrl || `${config.baseUrl}${config.userInfoPath}`;

    try {
      const response = await fetch(userInfoUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SSO:${provider}] Userinfo failed: ${response.status} ${errorText}`);
        throw new Error(`Failed to get user info: ${response.status}`);
      }

      let data = await response.json();

      // GitHub: Need to fetch email separately if not public
      if (provider === 'github' && !data.email && config.emailsUrl) {
        data.email = await this._fetchGitHubEmail(accessToken, config.emailsUrl);
      }

      return this.normalizeUserInfo(provider, data);
    } catch (error) {
      console.error(`[SSO:${provider}] Userinfo error:`, error);
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  /**
   * Fetch primary email from GitHub (emails might not be in user profile)
   */
  async _fetchGitHubEmail(accessToken, emailsUrl) {
    try {
      const response = await fetch(emailsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const emails = await response.json();
        // Find primary email or first verified email
        const primary = emails.find(e => e.primary && e.verified);
        const verified = emails.find(e => e.verified);
        return primary?.email || verified?.email || emails[0]?.email || null;
      }
    } catch (error) {
      console.error('[SSO:github] Failed to fetch emails:', error);
    }
    return null;
  }

  /**
   * Normalize user info from different providers to a standard format
   */
  normalizeUserInfo(provider, rawData) {
    let normalized;

    switch (provider) {
      case 'google':
        normalized = {
          provider,
          providerId: rawData.sub,
          email: rawData.email,
          emailVerified: rawData.email_verified === true,
          name: rawData.name,
          username: rawData.email?.split('@')[0],
          picture: rawData.picture,
          raw: rawData
        };
        break;

      case 'microsoft':
        normalized = {
          provider,
          providerId: rawData.id,
          email: rawData.mail || rawData.userPrincipalName,
          emailVerified: true, // Microsoft emails are verified
          name: rawData.displayName,
          username: rawData.userPrincipalName?.split('@')[0] || rawData.mail?.split('@')[0],
          picture: null, // Microsoft Graph needs separate call for photo
          raw: rawData
        };
        break;

      case 'github':
        normalized = {
          provider,
          providerId: String(rawData.id),
          email: rawData.email,
          emailVerified: true, // We only get verified emails
          name: rawData.name || rawData.login,
          username: rawData.login,
          picture: rawData.avatar_url,
          raw: rawData
        };
        break;

      case 'simpatik':
      default:
        normalized = {
          provider,
          providerId: rawData.sub || rawData.id || rawData.user_id,
          email: rawData.email,
          emailVerified: rawData.email_verified !== false,
          name: rawData.name || rawData.full_name || rawData.fullName,
          username: rawData.username || rawData.preferred_username || rawData.email?.split('@')[0],
          picture: rawData.picture || rawData.avatar,
          role: rawData.role,
          raw: rawData
        };
        break;
    }

    if (!normalized.providerId) {
      throw new Error('No user ID in SSO response');
    }

    return normalized;
  }

  /**
   * Get list of available SSO providers with their status
   */
  getAvailableProviders() {
    const providers = ['simpatik', 'google', 'microsoft', 'github'];
    return providers.map(provider => {
      try {
        const config = this.getProviderConfig(provider);
        return {
          id: provider,
          name: config.name,
          enabled: this.isProviderEnabled(provider)
        };
      } catch {
        return {
          id: provider,
          name: provider,
          enabled: false
        };
      }
    }).filter(p => p.enabled);
  }
}

module.exports = new SsoService();
