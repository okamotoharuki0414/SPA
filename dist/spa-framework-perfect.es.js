class PerfectSPAFramework {
  constructor(config) {
    this.eventSource = null;
    this.serviceWorker = null;
    this.performanceObserver = null;
    this.cache = /* @__PURE__ */ new Map();
    this.config = this.mergeWithDefaults(config);
    this.detectEnvironment();
    this.initializeServices();
    this.init();
  }
  /**
   * Environment Detection
   */
  detectEnvironment() {
    const env = typeof window !== "undefined" ? window : global;
    this.config.ai = {
      CLAUDE_CODE: !!env.claude || process.env.CLAUDE_ENV === "true",
      GEMINI: !!(process.env.GEMINI_API_KEY || process.env.AI_ASSISTANT === "gemini"),
      HYBRID: process.env.AI_COLLABORATION === "true",
      environment: process.env.NODE_ENV || "development"
    };
    console.log("🤖 AI Environment detected:", this.config.ai);
  }
  /**
   * Service Initialization
   */
  initializeServices() {
    this.analytics = new AnalyticsService(this.config);
    this.security = new SecurityService(this.config.security);
    this.aiCollaboration = new AICollaborationService(this.config.ai);
  }
  /**
   * Main Initialization
   */
  async init() {
    try {
      console.log("🚀 Perfect SPA Framework v2.0 initializing...");
      await this.initializeCore();
      if (this.config.performance.bundleOptimization) {
        this.initPerformanceMonitoring();
      }
      if (this.config.performance.serviceWorker) {
        await this.initServiceWorker();
      }
      if (this.config.security.csrf || this.config.security.csp) {
        this.security.initialize();
      }
      if (this.config.ai.HYBRID) {
        await this.aiCollaboration.initialize();
      }
      await this.initializeFeatures();
      console.log("✅ Perfect SPA Framework ready!");
      this.analytics.track("spa_initialized", { version: "2.0" });
    } catch (error) {
      console.error("❌ SPA Framework initialization failed:", error);
      this.handleError(error, "initialization");
    }
  }
  /**
   * Core Framework Initialization
   */
  async initializeCore() {
    await this.initSSEWithRetry();
    this.initEnhancedForms();
    this.initSmartCaching();
    this.initErrorBoundaries();
  }
  /**
   * Enhanced SSE with retry and reconnection
   */
  async initSSEWithRetry(maxRetries = 5, delay = 1e3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.initSSE();
        return;
      } catch (error) {
        console.warn(`SSE connection attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw new Error(`SSE connection failed after ${maxRetries} attempts`);
        }
        await this.sleep(delay * Math.pow(2, attempt - 1));
      }
    }
  }
  /**
   * SSE Connection
   */
  initSSE() {
    return new Promise((resolve, reject) => {
      if (!this.config.workSetId) {
        console.warn("workSetId not configured, skipping SSE");
        resolve();
        return;
      }
      try {
        this.eventSource = new EventSource(`${this.config.sseUrl}/sse/${this.config.workSetId}`);
        const timeout = setTimeout(() => {
          reject(new Error("SSE connection timeout"));
        }, 1e4);
        this.eventSource.onopen = () => {
          clearTimeout(timeout);
          console.log("🔗 SSE connection established");
          this.analytics.track("sse_connected");
          resolve();
        };
        this.eventSource.onmessage = (event) => {
          this.handleSSEMessage(JSON.parse(event.data));
        };
        this.eventSource.onerror = (error) => {
          clearTimeout(timeout);
          console.error("❌ SSE connection error:", error);
          this.analytics.track("sse_error", { error: error.toString() });
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  /**
   * Enhanced Form Handling with validation
   */
  initEnhancedForms() {
    document.addEventListener("submit", async (event) => {
      const form = event.target;
      if (form.hasAttribute("data-spa-ignore"))
        return;
      event.preventDefault();
      try {
        const isValid = await this.validateForm(form);
        if (!isValid)
          return;
        if (this.config.security.sanitization) {
          this.security.sanitizeFormData(form);
        }
        await this.submitFormWithAnalytics(form);
      } catch (error) {
        this.handleError(error, "form_submission");
      }
    });
  }
  /**
   * Form Validation
   */
  async validateForm(form) {
    const formData = new FormData(form);
    let isValid = true;
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        if (this.security.detectXSS(value)) {
          this.showNotification(`不正な入力が検出されました: ${key}`, "error");
          isValid = false;
        }
        if (this.security.detectSQLInjection(value)) {
          this.showNotification(`不正なクエリが検出されました: ${key}`, "error");
          isValid = false;
        }
      }
    }
    return isValid;
  }
  /**
   * Smart Caching System
   */
  initSmartCaching() {
    const cacheConfig = this.config.performance.caching;
    this.interceptAPIRequests((url, response) => {
      if (cacheConfig.api > 0) {
        const cacheKey = this.generateCacheKey(url);
        this.cache.set(cacheKey, {
          data: response,
          timestamp: Date.now(),
          ttl: cacheConfig.api * 1e3
        });
        setTimeout(() => {
          this.cache.delete(cacheKey);
        }, cacheConfig.api * 1e3);
      }
    });
  }
  /**
   * Performance Monitoring
   */
  initPerformanceMonitoring() {
    if ("PerformanceObserver" in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.analytics.trackPerformance(entry);
        }
      });
      this.performanceObserver.observe({
        entryTypes: ["navigation", "paint", "largest-contentful-paint", "first-input", "layout-shift"]
      });
    }
    this.trackCustomMetrics();
  }
  /**
   * Service Worker Registration
   */
  async initServiceWorker() {
    if ("serviceWorker" in navigator) {
      try {
        this.serviceWorker = await navigator.serviceWorker.register("/sw.js");
        console.log("📦 Service Worker registered:", this.serviceWorker);
        this.serviceWorker.addEventListener("updatefound", () => {
          const newWorker = this.serviceWorker.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed") {
                this.showNotification("新しいバージョンが利用可能です", "info");
              }
            });
          }
        });
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    }
  }
  /**
   * Feature Initialization
   */
  async initializeFeatures() {
    const features = this.config.features;
    if (features.pwa) {
      await this.initPWA();
    }
    if (features.a11y) {
      this.initAccessibility();
    }
    if (features.darkMode) {
      this.initDarkMode();
    }
    if (features.offline) {
      await this.initOfflineSupport();
    }
  }
  /**
   * Error Handling with AI Collaboration
   */
  handleError(error, context) {
    const errorInfo = {
      timestamp: /* @__PURE__ */ new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.generateSessionId(),
      aiAssistant: this.getActiveAIAssistant()
    };
    console.error(`[${context}] Error:`, error, errorInfo);
    this.analytics.trackError(error, errorInfo);
    if (this.config.ai.HYBRID) {
      this.aiCollaboration.analyzeError(error, errorInfo);
    }
    this.showNotification("エラーが発生しました。しばらくお待ちください。", "error");
  }
  /**
   * AI Assistant Detection
   */
  getActiveAIAssistant() {
    const ai = this.config.ai;
    if (ai.HYBRID)
      return "claude+gemini";
    if (ai.CLAUDE_CODE)
      return "claude-code";
    if (ai.GEMINI)
      return "gemini";
    return "none";
  }
  /**
   * Utility Methods
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  generateCacheKey(url) {
    return `spa_cache_${btoa(url)}_${this.config.workSetId}`;
  }
  generateSessionId() {
    return `spa_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  mergeWithDefaults(config) {
    return {
      workSetId: config.workSetId || "",
      baseUrl: config.baseUrl || "",
      sseUrl: config.sseUrl || "http://localhost:3005",
      debug: config.debug || false,
      ai: config.ai || {},
      performance: {
        bundleOptimization: true,
        lazyLoading: true,
        caching: {
          api: 300,
          static: 3600,
          strategy: "stale-while-revalidate"
        },
        preloading: true,
        serviceWorker: true,
        ...config.performance
      },
      security: {
        csrf: true,
        csp: true,
        sanitization: true,
        encryption: false,
        rateLimiting: {
          api: 100,
          sse: 5,
          enabled: true
        },
        ...config.security
      },
      features: {
        offline: true,
        pwa: true,
        analytics: true,
        a11y: true,
        darkMode: true,
        ...config.features
      }
    };
  }
  // Additional methods would be implemented here...
  handleSSEMessage(data) {
  }
  showNotification(message, type) {
  }
  submitFormWithAnalytics(form) {
    return Promise.resolve();
  }
  interceptAPIRequests(callback) {
  }
  trackCustomMetrics() {
  }
  initPWA() {
    return Promise.resolve();
  }
  initAccessibility() {
  }
  initDarkMode() {
  }
  initOfflineSupport() {
    return Promise.resolve();
  }
  initErrorBoundaries() {
  }
}
class AnalyticsService {
  constructor(config) {
    this.config = config;
  }
  track(event, data) {
    if (this.config.debug) {
      console.log("📊 Analytics:", event, data);
    }
  }
  trackError(error, context) {
    this.track("error", { error: error.message, context });
  }
  trackPerformance(entry) {
    this.track("performance", {
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime
    });
  }
}
class SecurityService {
  constructor(config) {
    this.config = config;
  }
  initialize() {
    if (this.config.csp) {
      this.setupCSP();
    }
    if (this.config.csrf) {
      this.setupCSRF();
    }
  }
  detectXSS(input) {
    const xssPatterns = [/<script/i, /javascript:/i, /on\w+=/i];
    return xssPatterns.some((pattern) => pattern.test(input));
  }
  detectSQLInjection(input) {
    const sqlPatterns = [/union\s+select/i, /drop\s+table/i, /insert\s+into/i, /delete\s+from/i];
    return sqlPatterns.some((pattern) => pattern.test(input));
  }
  sanitizeFormData(form) {
  }
  setupCSP() {
  }
  setupCSRF() {
  }
}
class AICollaborationService {
  constructor(ai) {
    this.ai = ai;
  }
  async initialize() {
    console.log("🤖 AI Collaboration Service initialized");
  }
  async analyzeError(error, context) {
    if (this.ai.GEMINI) {
      console.log("🔍 Gemini analyzing error:", error.message);
    }
    if (this.ai.CLAUDE_CODE) {
      console.log("🧠 Claude Code handling error:", error.message);
    }
  }
}
if (typeof window !== "undefined") {
  window.PerfectSPAFramework = PerfectSPAFramework;
}
var spa_framework_perfect_default = PerfectSPAFramework;
export {
  spa_framework_perfect_default as default
};
