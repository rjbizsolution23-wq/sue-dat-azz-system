/**
 * ══════════════════════════════════════════════════════════════════
 * SUE DAT AZZ — Cloudflare Workers API Client
 * James Consumer Law Group | Jamaree R. James, Esq.
 * Built: March 6, 2026
 *
 * PURPOSE: Client-side API wrapper for all Cloudflare Worker endpoints.
 * These stub functions map to Cloudflare Worker routes deployed at:
 *   https://api.[your-domain].com  (or Workers subdomain)
 *
 * PRODUCTION SETUP:
 *   1. Deploy worker code in /workers/ directory to Cloudflare Workers
 *   2. Replace WORKERS_BASE_URL with your actual Workers domain
 *   3. Set wrangler secrets: MFSN_AID, MFSN_EMAIL, MFSN_PASSWORD,
 *      SENDGRID_API_KEY (or Resend), STRIPE_SECRET_KEY
 *   4. Wire real Stripe.js into checkout flows
 *
 * SECURITY: NEVER put API keys in this file. All secrets go in
 *   wrangler.toml [vars] (non-secret) or `wrangler secret put KEY`
 *   (for secret values). This is a CORS-enabled client — treat it
 *   as publicly readable.
 * ══════════════════════════════════════════════════════════════════
 */

'use strict';

// ── Configuration ──────────────────────────────────────────────────
const WORKERS_BASE_URL = ''; // Leave empty to use relative paths (same origin)
                              // For external Workers: 'https://api.suedatazz.com'

const MFSN_CONFIG = {
  AID:         'YOUR_MFSN_AID',       // ← Jamaree's MFSN Affiliate ID
  EMAIL:       'YOUR_MFSN_EMAIL',     // ← MFSN account email
  BASE_ENROLL: 'https://myfreescorenow.com/enroll/',
  PIDS: {
    // PID → { price, trial, commission, note }
    PID_1: { id: 'YOUR_PID_1', price: 29.90, trial: true,  trialAmt: 1.00, commission: 11.00, note: '$29.90/mo, $1 7-day trial' },
    PID_2: { id: 'YOUR_PID_2', price: 29.90, trial: false, trialAmt: 0,    commission: 12.25, note: '$29.90/mo, no trial'        },
    PID_3: { id: 'YOUR_PID_3', price: 24.97, trial: true,  trialAmt: 1.00, commission:  7.00, note: '$24.97/mo, $1 7-day trial' },
    PID_4: { id: 'YOUR_PID_4', price: 39.90, trial: false, trialAmt: 0,    commission: 16.00, note: '$39.90/mo, no trial'        },
  },
  DEFAULT_PID: 'PID_1',
};

// ──────────────────────────────────────────────────────────────────
// SECTION 1: CORE HTTP HELPERS
// ──────────────────────────────────────────────────────────────────

/**
 * Generic fetch wrapper with error handling and timeout.
 * @param {string} endpoint - Relative or absolute URL
 * @param {object} options  - fetch options
 * @param {number} timeoutMs - Request timeout in milliseconds (default 10s)
 */
async function apiRequest(endpoint, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = endpoint.startsWith('http') ? endpoint : WORKERS_BASE_URL + endpoint;

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'X-Source': 'sue-dat-azz-client',
      ...options.headers,
    },
    signal: controller.signal,
  };

  try {
    const res = await fetch(url, { ...defaultOptions, ...options });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      throw new ApiError(res.status, errText, endpoint);
    }

    // Handle 204 No Content (DELETE responses)
    if (res.status === 204) return { success: true };

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    return await res.text();

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new ApiError(408, 'Request timeout after ' + timeoutMs + 'ms', endpoint);
    }
    throw err;
  }
}

class ApiError extends Error {
  constructor(status, message, endpoint) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

// ──────────────────────────────────────────────────────────────────
// SECTION 2: LEAD MANAGEMENT (Tables API)
// ──────────────────────────────────────────────────────────────────

/**
 * Submit a new lead from any stage.
 * Writes to the `leads` table via the RESTful Tables API.
 * Non-blocking by design — always shows success to user even if API fails.
 */
async function submitLead(leadData) {
  const payload = {
    ...leadData,
    submitted_at: leadData.submitted_at || new Date().toISOString(),
    page_url: leadData.page_url || window.location.href,
    utm_source:   getSessionItem('utm_source', 'organic'),
    utm_medium:   getSessionItem('utm_medium', 'direct'),
    utm_campaign: getSessionItem('utm_campaign', 'stage1-intake'),
    b2b_risk_score: parseInt(getSessionItem('b2b_risk_score', '0')),
  };

  try {
    const result = await apiRequest('tables/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    console.log('[LeadAPI] Lead saved:', result.id || 'ok');
    return { success: true, id: result.id };
  } catch (err) {
    // Silently fail — never block user flow on API errors
    console.warn('[LeadAPI] Non-blocking lead save error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Retrieve all leads for CRM / dashboard view.
 * @param {object} params - { page, limit, search, sort }
 */
async function getLeads(params = {}) {
  const query = new URLSearchParams({
    page:  params.page  || 1,
    limit: params.limit || 50,
    sort:  params.sort  || 'created_at',
    ...(params.search ? { search: params.search } : {}),
  }).toString();

  return apiRequest('tables/leads?' + query);
}

/**
 * Update lead status (e.g. mark as contacted, case opened, etc.)
 */
async function updateLead(leadId, updates) {
  return apiRequest('tables/leads/' + leadId, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// ──────────────────────────────────────────────────────────────────
// SECTION 3: EMAIL AUTOMATION (Cloudflare Worker → SendGrid/Resend)
// ──────────────────────────────────────────────────────────────────

/**
 * Trigger a nurture email sequence via the Cloudflare Worker.
 * Worker endpoint: POST /api/email/trigger
 * Worker handles: sequence selection, SendGrid API call, unsubscribe token gen
 *
 * @param {string} email
 * @param {string} firstName
 * @param {string} sequence - 'legal_welcome' | 'credit_welcome' | 'b2b_welcome' | 'demand_kit_delivery' | 'course_welcome' | 'shield_welcome'
 * @param {object} metadata - Extra data passed to email template
 */
async function triggerEmailSequence(email, firstName, sequence, metadata = {}) {
  const payload = {
    email,
    first_name: firstName,
    sequence,
    metadata: {
      ...metadata,
      firm_name: 'James Consumer Law Group',
      attorney: 'Jamaree R. James, Esq.',
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    },
    triggered_at: new Date().toISOString(),
  };

  try {
    const result = await apiRequest('/api/email/trigger', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    console.log('[EmailAPI] Sequence triggered:', sequence, '→', email);
    return result;
  } catch (err) {
    console.warn('[EmailAPI] Email trigger error (non-blocking):', err.message);
    return { success: false };
  }
}

/**
 * Email sequences and their purposes.
 * Reference for Worker-side template configuration.
 *
 * SEQUENCE MAP:
 * ┌─────────────────────┬─────────────────────────────────────────────────────┐
 * │ legal_welcome       │ Delivers violation checklist PDF + books consult     │
 * │ credit_welcome      │ Delivers MFSN $1 trial link + FCRA scan intro        │
 * │ b2b_welcome         │ Delivers risk report + compliance consultation invite │
 * │ demand_kit_delivery │ Delivers $37 kit download link + next step: Shield    │
 * │ course_welcome      │ Module 1 access link + community invite              │
 * │ shield_welcome      │ Membership confirmation + attorney hotline access     │
 * │ nurture_7day        │ 7-email FDCPA education sequence (drip, days 1–7)    │
 * │ nurture_legal_14    │ 14-day legal upsell sequence for non-converters       │
 * │ referral_invite     │ Referral program invitation (after purchase/close)    │
 * └─────────────────────┴─────────────────────────────────────────────────────┘
 */

// ──────────────────────────────────────────────────────────────────
// SECTION 4: MFSN API PROXY (via Cloudflare Worker)
// ──────────────────────────────────────────────────────────────────
// The Worker proxies MFSN API calls to avoid CORS issues and to keep
// MFSN credentials server-side.
// Worker endpoint base: /api/mfsn/

/**
 * Get MFSN enrollment URL with correct AID + PID.
 * @param {string} pidKey - Key from MFSN_CONFIG.PIDS (e.g. 'PID_1')
 * @param {object} extraParams - Extra URL params to append
 */
function getMFSNEnrollUrl(pidKey, extraParams = {}) {
  const pid = MFSN_CONFIG.PIDS[pidKey] || MFSN_CONFIG.PIDS[MFSN_CONFIG.DEFAULT_PID];
  const base = MFSN_CONFIG.BASE_ENROLL + '?AID=' + MFSN_CONFIG.AID + '&PID=' + pid.id;
  const extras = Object.entries(extraParams)
    .filter(function([, v]) { return v; })
    .map(function([k, v]) { return encodeURIComponent(k) + '=' + encodeURIComponent(v); })
    .join('&');
  return base + (extras ? '&' + extras : '');
}

/**
 * Fetch a subscriber's MFSN credit snapshot (via Worker proxy).
 * Worker handles MFSN auth token, proxies to MFSN API.
 * @param {string} subscriberId - Internal subscriber ID
 */
async function getMFSNSnapshot(subscriberId) {
  return apiRequest('/api/mfsn/snapshot/' + subscriberId);
}

/**
 * Pull a subscriber's 3-bureau report (via Worker proxy).
 * Triggers the MFSN POST /auth/3B/report.json endpoint server-side.
 * @param {string} subscriberId
 */
async function getMFSN3BReport(subscriberId) {
  return apiRequest('/api/mfsn/report/3bureau/' + subscriberId);
}

/**
 * Check enrollment status for a given email address (via Worker proxy).
 */
async function checkMFSNEnrollment(email) {
  return apiRequest('/api/mfsn/enrollment/check', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

// ──────────────────────────────────────────────────────────────────
// SECTION 5: STRIPE PAYMENT HELPERS (client-side, Stripe.js)
// ──────────────────────────────────────────────────────────────────
// Stripe.js must be loaded: <script src="https://js.stripe.com/v3/"></script>

const STRIPE_PUBLISHABLE_KEY = 'pk_live_YOUR_STRIPE_PUBLISHABLE_KEY'; // ← replace on launch

/**
 * Initialize Stripe.js instance.
 * Returns null if Stripe.js is not loaded (non-checkout pages).
 */
function getStripe() {
  if (typeof Stripe === 'undefined') {
    console.warn('[StripeAPI] Stripe.js not loaded. Add <script src="https://js.stripe.com/v3/"></script>');
    return null;
  }
  return Stripe(STRIPE_PUBLISHABLE_KEY);
}

/**
 * Create a Stripe Checkout session via Worker and redirect.
 * Worker endpoint: POST /api/stripe/checkout
 *
 * @param {string} priceId - Stripe Price ID
 * @param {string} email   - Customer email (prefills checkout)
 * @param {object} metadata - Passed to Stripe session metadata
 */
async function createStripeCheckout(priceId, email, metadata = {}) {
  const stripe = getStripe();
  if (!stripe) {
    console.error('[StripeAPI] Stripe not available — using simulated checkout');
    return { success: false, error: 'Stripe not loaded' };
  }

  try {
    const session = await apiRequest('/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({
        price_id: priceId,
        email,
        metadata,
        success_url: window.location.origin + '/stage2-tripwire.html?checkout=success&session_id={CHECKOUT_SESSION_ID}',
        cancel_url:  window.location.origin + '/stage2-tripwire.html?checkout=cancelled',
      }),
    });

    if (session.checkout_url) {
      window.location.href = session.checkout_url;
      return { success: true };
    }

    const result = await stripe.redirectToCheckout({ sessionId: session.session_id });
    if (result.error) throw new Error(result.error.message);
    return { success: true };

  } catch (err) {
    console.error('[StripeAPI] Checkout error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Create a Stripe subscription (Legal Shield $49/mo or B2B retainer).
 * Worker endpoint: POST /api/stripe/subscription
 */
async function createStripeSubscription(priceId, email, metadata = {}) {
  return apiRequest('/api/stripe/subscription', {
    method: 'POST',
    body: JSON.stringify({ price_id: priceId, email, metadata }),
  });
}

/**
 * Stripe Price IDs — wire to your actual Stripe dashboard on launch.
 * Format: price_[environment]_[product]
 */
const STRIPE_PRICE_IDS = {
  // One-time products
  DEMAND_LETTER_KIT:    'price_live_demand_letter_37',       // $37 one-time
  CREDIT_WARFARE_COURSE:'price_live_credit_warfare_97',      // $97 one-time
  B2B_AUDIT_DEPOSIT:    'price_live_b2b_audit_5000',         // $5,000 deposit
  // Subscriptions
  LEGAL_SHIELD_MONTHLY: 'price_live_shield_49_month',        // $49/mo
  LEGAL_SHIELD_FOUNDING:'price_live_shield_29_month',        // $29/mo founding
  B2B_RETAINER_2500:    'price_live_b2b_retainer_2500_month',// $2,500/mo
  B2B_RETAINER_5000:    'price_live_b2b_retainer_5000_month',// $5,000/mo
};

// ──────────────────────────────────────────────────────────────────
// SECTION 6: UTM + SESSION TRACKING
// ──────────────────────────────────────────────────────────────────

/**
 * Capture UTM params from URL and store in sessionStorage.
 * Call this on every page load.
 */
function captureUTMParams() {
  const p = new URLSearchParams(window.location.search);
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  utmKeys.forEach(function(key) {
    const val = p.get(key);
    if (val) {
      try { sessionStorage.setItem(key, val); } catch(e) {}
    }
  });
}

/**
 * Get all stored UTM params.
 * @returns {object}
 */
function getUTMData() {
  return {
    utm_source:   getSessionItem('utm_source',   'organic'),
    utm_medium:   getSessionItem('utm_medium',   'direct'),
    utm_campaign: getSessionItem('utm_campaign', 'sue-dat-azz'),
    utm_content:  getSessionItem('utm_content',  ''),
    utm_term:     getSessionItem('utm_term',     ''),
  };
}

/**
 * Safe sessionStorage getter with fallback.
 */
function getSessionItem(key, fallback) {
  try { return sessionStorage.getItem(key) || fallback; } catch(e) { return fallback; }
}

// ──────────────────────────────────────────────────────────────────
// SECTION 7: ANALYTICS EVENTS
// ──────────────────────────────────────────────────────────────────

/**
 * Track a funnel event.
 * Fires to Cloudflare Analytics (via Worker beacon) + console in dev.
 *
 * @param {string} event - Event name (see EVENT_NAMES below)
 * @param {object} properties - Event properties
 */
async function trackEvent(event, properties = {}) {
  const payload = {
    event,
    properties: {
      ...properties,
      ...getUTMData(),
      page: window.location.pathname,
      referrer: document.referrer || 'direct',
      timestamp: new Date().toISOString(),
    },
  };

  if (process && process.env && process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event, payload.properties);
    return;
  }

  // Non-blocking beacon to Worker analytics endpoint
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/event', JSON.stringify(payload));
    } else {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
  } catch(e) { /* non-blocking */ }
}

/**
 * Standard funnel event names.
 * Keep these consistent across all pages.
 */
const EVENT_NAMES = {
  // Stage 1 — Intake Portal
  PAGE_LOAD:              'stage1_page_load',
  PATH_SELECTED:          'path_selected',          // { path: 'legal'|'credit'|'b2b' }
  VIOLATION_CHECKED:      'violation_checked',       // { count, potential_damages }
  QUALIFY_GATE_SHOWN:     'qualify_gate_shown',      // { violations, path }
  LEAD_FORM_OPENED:       'lead_form_opened',        // { context }
  LEAD_SUBMITTED:         'lead_submitted',          // { path, violations, source }
  MFSN_REDIRECT:          'mfsn_redirect',           // { pid }
  SCORECARD_COMPLETED:    'scorecard_completed',     // { score, risk_level }
  // Stage 2 — Tripwire
  TRIPWIRE_PAGE_LOAD:     'stage2_page_load',        // { path }
  CHECKOUT_OPENED:        'checkout_opened',         // { offer, price }
  CHECKOUT_COMPLETED:     'checkout_completed',      // { offer, price, email }
  CHECKOUT_ABANDONED:     'checkout_abandoned',      // { offer }
  // Conversion
  LEGAL_SHIELD_VIEWED:    'legal_shield_viewed',
  LEGAL_SHIELD_ENROLLED:  'legal_shield_enrolled',
  CONSULT_BOOKED:         'consult_booked',
  CASE_OPENED:            'case_opened',
};

// ──────────────────────────────────────────────────────────────────
// SECTION 8: DAMAGE CALCULATOR (used in violation checklist)
// ──────────────────────────────────────────────────────────────────

/**
 * Calculate potential FDCPA damages.
 * 15 U.S.C. § 1692k — $1,000 statutory max per action + actual + atty fees
 *
 * @param {number} violations - Number of checked violations
 * @param {number} actualDamages - Estimated actual damages (default 0)
 * @returns {object} - { statutory, actual, total, withFees }
 */
function calcFDCPADamages(violations, actualDamages = 0) {
  const statutory = Math.min(violations * 1000, 1000); // $1,000 max statutory per action
  const actual = actualDamages;
  const total = statutory + actual;
  return {
    statutory,
    actual,
    total,
    withFees: total, // attorney fees recovered separately under § 1692k(a)(3)
    perViolation: 1000,
    note: '15 U.S.C. § 1692k — max $1,000 statutory per action + actual damages + attorney fees',
  };
}

/**
 * Calculate TCPA damages.
 * 47 U.S.C. § 227(b)(3) — $500/call, $1,500/call if willful
 *
 * @param {number} calls - Number of violating calls/texts
 * @param {boolean} willful - Whether violations were willful (trebling)
 */
function calcTCPADamages(calls, willful = false) {
  const perCall = willful ? 1500 : 500;
  return {
    perCall,
    totalCalls: calls,
    total: perCall * calls,
    willful,
    cite: '47 U.S.C. § 227(b)(3)',
    note: willful ? 'Trebled damages for willful violations' : 'Standard $500/call',
  };
}

/**
 * Calculate FCRA damages.
 * 15 U.S.C. § 1681n — $100–$1,000 per willful violation + punitive
 * 15 U.S.C. § 1681o — actual damages for negligent violations
 *
 * @param {number} violations - Number of violations
 * @param {boolean} willful
 */
function calcFCRADamages(violations, willful = true) {
  const perViolation = willful ? 1000 : 0; // $100–$1,000 range; use $1,000 for max
  return {
    statutory: willful ? Math.min(violations * 1000, 1000) : 0,
    actualDamages: 'calculate based on credit denial, rate increases, emotional distress',
    punitiveAvailable: willful,
    attyFeesRecoverable: true,
    cite: willful ? '15 U.S.C. § 1681n' : '15 U.S.C. § 1681o',
  };
}

// ──────────────────────────────────────────────────────────────────
// SECTION 9: AUTO-INIT
// ──────────────────────────────────────────────────────────────────

// Run on every page that loads this script
(function init() {
  captureUTMParams();

  // Expose public API on window for easy use in inline scripts
  window.SDAApi = {
    submitLead,
    getLeads,
    updateLead,
    triggerEmailSequence,
    getMFSNEnrollUrl,
    getMFSNSnapshot,
    getMFSN3BReport,
    checkMFSNEnrollment,
    createStripeCheckout,
    createStripeSubscription,
    trackEvent,
    calcFDCPADamages,
    calcTCPADamages,
    calcFCRADamages,
    getUTMData,
    MFSN_CONFIG,
    STRIPE_PRICE_IDS,
    EVENT_NAMES,
  };

  console.log(
    '%c⚖️ SDA Workers API Client v1.0 loaded | March 6, 2026',
    'color:#F5C842;font-weight:bold;'
  );
  console.log(
    '%cJames Consumer Law Group | Jamaree R. James, Esq. | Replace YOUR_MFSN_AID + Stripe keys before launch.',
    'color:#8892a4;font-size:11px;'
  );
})();
