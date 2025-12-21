const rateLimit = require('express-rate-limit');

// Tier-based rate limits
const TIER_LIMITS = {
  free: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per 15 minutes
  },
  pro: {
    windowMs: 15 * 60 * 1000,
    max: 500 // 500 requests per 15 minutes
  },
  enterprise: {
    windowMs: 15 * 60 * 1000,
    max: 2000 // 2000 requests per 15 minutes
  }
};

/**
 * Create rate limiter based on user's subscription tier
 */
const createTierBasedLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: async (req) => {
      // If user is authenticated and has a profile, use their tier limit
      if (req.profile && req.profile.subscription_tier) {
        const tier = req.profile.subscription_tier;
        return TIER_LIMITS[tier]?.max || TIER_LIMITS.free.max;
      }
      // Default to free tier limits
      return TIER_LIMITS.free.max;
    },
    message: {
      error: 'Too Many Requests',
      message: 'You have exceeded the rate limit for your subscription tier. Please try again later or upgrade your plan.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip rate limiting for certain endpoints
    skip: (req) => {
      return req.path === '/health' || req.path === '/api/health';
    }
  });
};

/**
 * Strict rate limiter for auth endpoints
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for sync operations (more restrictive)
 */
const syncRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => {
    if (req.profile) {
      const tier = req.profile.subscription_tier;
      // Free: 1 sync/hour, Pro: 10 syncs/hour, Enterprise: 60 syncs/hour
      const limits = { free: 1, pro: 10, enterprise: 60 };
      return limits[tier] || limits.free;
    }
    return 1;
  },
  message: {
    error: 'Sync Rate Limit Exceeded',
    message: 'You have exceeded the sync rate limit for your subscription tier. Please upgrade to sync more frequently.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  createTierBasedLimiter,
  authRateLimiter,
  syncRateLimiter
};
