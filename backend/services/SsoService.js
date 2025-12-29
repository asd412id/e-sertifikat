const crypto = require('crypto');

/**
 * SSO Service for AMDPT/SIMPATIK Integration
 * Handles OAuth2 Authorization Code flow
 * 
 * Based on AMDPT SSO API v2.1.0 Documentation
 * Base URL: https://app.maccaqe.id
 * API Prefix: /api/v1
 * 
 * Endpoints:
 * - Authorization: GET /api/v1/sso/authorize
 * - Token Exchange: POST /api/v1/sso/token
 * - User Info: GET /api/v1/sso/userinfo
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
  getProviderConfig(provider = 'simpatik') {
    const configs = {
      simpatik: {
        name: 'SIMPATIK',
        enabled: process.env.SSO_SIMPATIK_ENABLED === 'true',
        clientId: process.env.SSO_SIMPATIK_CLIENT_ID,
        clientSecret: process.env.SSO_SIMPATIK_CLIENT_SECRET,
        baseUrl: process.env.SSO_SIMPATIK_BASE_URL || 'https://app.maccaqe.id',
        redirectUri: process.env.SSO_SIMPATIK_REDIRECT_URI,
        scopes: (process.env.SSO_SIMPATIK_SCOPES || 'openid profile email').split(' '),
        // Endpoints based on AMDPT SSO API v2.1.0 documentation
        // API prefix is /api/v1
        authorizePath: process.env.SSO_SIMPATIK_AUTHORIZE_PATH || '/api/v1/sso/authorize',
        tokenPath: process.env.SSO_SIMPATIK_TOKEN_PATH || '/api/v1/sso/token',
        userInfoPath: process.env.SSO_SIMPATIK_USERINFO_PATH || '/api/v1/sso/userinfo'
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
  isProviderEnabled(provider = 'simpatik') {
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

    return `${config.baseUrl}${config.authorizePath}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * Based on AMDPT SSO API v2.1.0 documentation
   * @param {string} provider - Provider name
   * @param {string} code - Authorization code from callback
   */
  async exchangeCodeForToken(provider, code) {
    const config = this.getProviderConfig(provider);
    const tokenUrl = `${config.baseUrl}${config.tokenPath}`;

    // Request body
    const bodyData = {
      code: code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri
    };

    console.log(`[SSO] Token exchange URL: ${tokenUrl}`);
    console.log(`[SSO] Token exchange params: code=***, client_id=${config.clientId}, redirect_uri=${config.redirectUri}`);

    try {
      // Try JSON format first (some servers prefer this despite docs saying form-urlencoded)
      let response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(bodyData)
      });

      console.log(`[SSO] Token response status (JSON): ${response.status}`);

      // If JSON fails with 415, try form-urlencoded
      if (response.status === 415) {
        console.log(`[SSO] JSON format rejected, trying form-urlencoded...`);
        const params = new URLSearchParams();
        params.append('code', code);
        params.append('client_id', config.clientId);
        params.append('client_secret', config.clientSecret);
        params.append('redirect_uri', config.redirectUri);

        response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: params.toString()
        });
        console.log(`[SSO] Token response status (form-urlencoded): ${response.status}`);
      }

      const responseText = await response.text();
      
      if (!response.ok) {
        console.error(`[SSO] Token exchange failed: ${response.status} ${responseText}`);
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error(`[SSO] Failed to parse token response: ${responseText}`);
        throw new Error('Invalid JSON response from token endpoint');
      }

      console.log(`[SSO] Token exchange success, got access_token: ${data.access_token ? 'yes' : 'no'}`);

      // AMDPT response includes: access_token, token_type, expires_in, id_token, user
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
        // AMDPT also returns user object directly
        user: data.user || null
      };
    } catch (error) {
      console.error('[SSO] Token exchange error:', error);
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
    const userInfoUrl = `${config.baseUrl}${config.userInfoPath}`;

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
        console.error(`SSO userinfo failed: ${response.status} ${errorText}`);
        throw new Error(`Failed to get user info: ${response.status}`);
      }

      const data = await response.json();

      // Normalize user info based on documentation response:
      // { "sub": "uuid-user", "name": "Nama User", "email": "email@example.com", ... }
      return this.normalizeUserInfo(provider, data);
    } catch (error) {
      console.error('SSO userinfo error:', error);
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  /**
   * Normalize user info from different providers to a standard format
   * AMDPT returns: { sub, name, email, role }
   */
  normalizeUserInfo(provider, rawData) {
    // Standard fields mapping based on AMDPT SSO docs
    const normalized = {
      provider,
      providerId: rawData.sub || rawData.id || rawData.user_id,
      email: rawData.email || null,
      emailVerified: rawData.email_verified !== false, // Assume verified if not specified
      name: rawData.name || rawData.full_name || rawData.fullName || null,
      username: rawData.username || rawData.preferred_username || rawData.email?.split('@')[0] || null,
      picture: rawData.picture || rawData.avatar || null,
      role: rawData.role || null, // AMDPT specific: user role (PTK, SEKOLAH, etc.)
      raw: rawData // Keep raw data for debugging/additional fields
    };

    if (!normalized.providerId) {
      throw new Error('No user ID (sub) in SSO response');
    }

    return normalized;
  }

  /**
   * Get list of available SSO providers with their status
   */
  getAvailableProviders() {
    const providers = ['simpatik'];
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
