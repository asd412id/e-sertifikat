const SsoService = require('../services/SsoService');
const AuthService = require('../services/AuthService');

class SsoController {
  /**
   * GET /api/auth/sso/providers
   * Get list of available SSO providers
   */
  async getProviders(request, reply) {
    try {
      const providers = SsoService.getAvailableProviders();
      reply.send({
        success: true,
        data: { providers }
      });
    } catch (error) {
      reply.status(500).send({
        error: 'Failed to get SSO providers'
      });
    }
  }

  /**
   * GET /api/auth/sso/redirect
   * Redirect to SSO provider for authentication
   * Query params: provider (default: simpatik), returnUrl (optional)
   */
  async redirectToProvider(request, reply) {
    try {
      const provider = request.query.provider || 'simpatik';
      const returnUrl = request.query.returnUrl || null;

      if (!SsoService.isProviderEnabled(provider)) {
        return reply.status(400).send({
          error: `SSO provider '${provider}' is not enabled or not configured`
        });
      }

      const state = SsoService.generateState();
      const authUrl = SsoService.buildAuthorizationUrl(provider, state, returnUrl);

      // Redirect to SSO provider
      reply.redirect(authUrl);
    } catch (error) {
      console.error('SSO redirect error:', error);
      reply.status(500).send({
        error: 'Failed to initialize SSO login'
      });
    }
  }

  /**
   * GET /api/auth/sso/callback
   * Handle callback from SSO provider (backend-based flow)
   * Query params: code, state
   */
  async handleCallback(request, reply) {
    try {
      const { code, state } = request.query;

      console.log('[SSO Callback] Received code and state');

      if (!code || !state) {
        return reply.status(400).send({
          error: 'Missing authorization code or state'
        });
      }

      // Validate state (CSRF protection)
      const stateData = SsoService.validateState(state);
      if (!stateData) {
        console.log('[SSO Callback] Invalid or expired state');
        return reply.status(400).send({
          error: 'Invalid or expired state. Please try logging in again.'
        });
      }

      const provider = stateData.provider || 'simpatik';
      const returnUrl = stateData.returnUrl;

      console.log(`[SSO Callback] Provider: ${provider}`);

      // Exchange code for token
      const tokenData = await SsoService.exchangeCodeForToken(provider, code);
      console.log('[SSO Callback] Token exchange successful');

      // Get user info
      const userInfo = await SsoService.getUserInfo(provider, tokenData.accessToken);
      console.log('[SSO Callback] User info received:', { 
        providerId: userInfo.providerId, 
        email: userInfo.email, 
        name: userInfo.name 
      });

      // Find or create user
      const { user, identity, isNewUser } = await AuthService.findOrCreateSsoUser(userInfo, tokenData);
      console.log('[SSO Callback] User found/created:', { 
        userId: user.id, 
        username: user.username, 
        isNewUser 
      });

      // Issue local JWT
      const token = AuthService.issueToken(user);
      console.log('[SSO Callback] JWT issued');

      // Determine redirect URL
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const callbackPath = '/auth/sso/callback';
      
      // Build redirect URL with token
      const redirectParams = new URLSearchParams({
        token,
        isNewUser: isNewUser ? '1' : '0',
        provider
      });

      if (returnUrl) {
        redirectParams.set('returnUrl', returnUrl);
      }

      const redirectUrl = `${frontendUrl}${callbackPath}?${redirectParams.toString()}`;
      console.log('[SSO Callback] Redirecting to frontend');

      // Redirect to frontend with token
      reply.redirect(redirectUrl);
    } catch (error) {
      console.error('[SSO Callback] Error:', error);

      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const errorParams = new URLSearchParams({
        error: 'sso_failed',
        message: error.message || 'SSO authentication failed'
      });

      reply.redirect(`${frontendUrl}/login?${errorParams.toString()}`);
    }
  }

  /**
   * POST /api/auth/sso/callback
   * Alternative: Handle callback via POST from frontend (code exchange)
   * Body: { code, state, provider }
   */
  async handleCallbackPost(request, reply) {
    try {
      const { code, state, provider: bodyProvider } = request.body;

      if (!code || !state) {
        return reply.status(400).send({
          error: 'Missing authorization code or state'
        });
      }

      // Validate state
      const stateData = SsoService.validateState(state);
      if (!stateData) {
        return reply.status(400).send({
          error: 'Invalid or expired state'
        });
      }

      const provider = bodyProvider || stateData.provider || 'simpatik';

      // Exchange code for token
      const tokenData = await SsoService.exchangeCodeForToken(provider, code);

      // Get user info
      const userInfo = await SsoService.getUserInfo(provider, tokenData.accessToken);

      // Find or create user
      const { user, identity, isNewUser } = await AuthService.findOrCreateSsoUser(userInfo, tokenData);

      // Issue local JWT
      const token = AuthService.issueToken(user);

      reply.send({
        success: true,
        message: isNewUser ? 'Account created via SSO' : 'Login successful',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName
          },
          token,
          isNewUser,
          provider
        }
      });
    } catch (error) {
      console.error('SSO callback POST error:', error);
      reply.status(400).send({
        error: error.message || 'SSO authentication failed'
      });
    }
  }

  /**
   * POST /api/auth/sso/link
   * Link SSO identity to current authenticated user
   * Body: { code, state, provider }
   */
  async linkIdentity(request, reply) {
    try {
      const { code, state, provider: bodyProvider } = request.body;
      const userId = request.user.userId;

      if (!code || !state) {
        return reply.status(400).send({
          error: 'Missing authorization code or state'
        });
      }

      // Validate state
      const stateData = SsoService.validateState(state);
      if (!stateData) {
        return reply.status(400).send({
          error: 'Invalid or expired state'
        });
      }

      const provider = bodyProvider || stateData.provider || 'simpatik';

      // Exchange code for token
      const tokenData = await SsoService.exchangeCodeForToken(provider, code);

      // Get user info
      const userInfo = await SsoService.getUserInfo(provider, tokenData.accessToken);

      // Link identity to user
      const identity = await AuthService.linkSsoIdentity(userId, userInfo, tokenData);

      reply.send({
        success: true,
        message: 'SSO identity linked successfully',
        data: {
          provider: identity.provider,
          providerEmail: identity.providerEmail,
          linkedAt: identity.createdAt
        }
      });
    } catch (error) {
      console.error('SSO link error:', error);
      reply.status(400).send({
        error: error.message || 'Failed to link SSO identity'
      });
    }
  }

  /**
   * DELETE /api/auth/sso/link/:provider
   * Unlink SSO identity from current user
   */
  async unlinkIdentity(request, reply) {
    try {
      const { provider } = request.params;
      const userId = request.user.userId;

      if (!provider) {
        return reply.status(400).send({
          error: 'Provider is required'
        });
      }

      const result = await AuthService.unlinkSsoIdentity(userId, provider);

      reply.send({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('SSO unlink error:', error);
      reply.status(400).send({
        error: error.message || 'Failed to unlink SSO identity'
      });
    }
  }

  /**
   * GET /api/auth/sso/identities
   * Get current user's linked SSO identities
   */
  async getIdentities(request, reply) {
    try {
      const userId = request.user.userId;
      const identities = await AuthService.getUserIdentities(userId);

      reply.send({
        success: true,
        data: { identities }
      });
    } catch (error) {
      console.error('Get identities error:', error);
      reply.status(500).send({
        error: 'Failed to get SSO identities'
      });
    }
  }

  /**
   * GET /api/auth/sso/init
   * Initialize SSO flow - returns auth URL for frontend redirect
   * Query params: provider, returnUrl, mode (login|link)
   */
  async initSso(request, reply) {
    try {
      const provider = request.query.provider || 'simpatik';
      const returnUrl = request.query.returnUrl || null;
      const mode = request.query.mode || 'login'; // 'login' or 'link'

      if (!SsoService.isProviderEnabled(provider)) {
        return reply.status(400).send({
          error: `SSO provider '${provider}' is not enabled`
        });
      }

      const state = SsoService.generateState();
      const authUrl = SsoService.buildAuthorizationUrl(provider, state, returnUrl);

      // Store mode in state for callback handling
      SsoService.storeState(state, { provider, returnUrl, mode });

      reply.send({
        success: true,
        data: {
          authUrl,
          state,
          provider
        }
      });
    } catch (error) {
      console.error('SSO init error:', error);
      reply.status(500).send({
        error: 'Failed to initialize SSO'
      });
    }
  }
}

module.exports = new SsoController();
