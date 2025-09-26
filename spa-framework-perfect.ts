/**
 * Perfect SPA Framework v2.0
 * Enhanced version with AI collaboration, performance optimization, and security
 */

// Environment Detection & AI Collaboration
interface AIEnvironment {
    CLAUDE_CODE: boolean;
    GEMINI: boolean;
    HYBRID: boolean;
    environment: 'development' | 'staging' | 'production';
}

// Configuration Interfaces
interface SPAConfig {
    workSetId: string;
    baseUrl: string;
    sseUrl: string;
    debug: boolean;
    ai: AIEnvironment;
    performance: PerformanceConfig;
    security: SecurityConfig;
    features: FeatureConfig;
}

interface PerformanceConfig {
    bundleOptimization: boolean;
    lazyLoading: boolean;
    caching: CacheConfig;
    preloading: boolean;
    serviceWorker: boolean;
}

interface CacheConfig {
    api: number;          // API cache TTL (seconds)
    static: number;       // Static resource cache TTL
    strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
}

interface SecurityConfig {
    csrf: boolean;
    csp: boolean;
    sanitization: boolean;
    encryption: boolean;
    rateLimiting: RateLimitConfig;
}

interface RateLimitConfig {
    api: number;          // requests per minute
    sse: number;          // connections per client
    enabled: boolean;
}

interface FeatureConfig {
    offline: boolean;
    pwa: boolean;
    analytics: boolean;
    a11y: boolean;        // accessibility
    darkMode: boolean;
}

// Performance Monitoring
interface PerformanceMetrics {
    fcp: number;          // First Contentful Paint
    lcp: number;          // Largest Contentful Paint
    fid: number;          // First Input Delay
    cls: number;          // Cumulative Layout Shift
    ttfb: number;         // Time to First Byte
}

// Error Tracking
interface ErrorContext {
    timestamp: Date;
    userAgent: string;
    url: string;
    userId?: string;
    sessionId: string;
    aiAssistant: string;
}

/**
 * Perfect SPA Framework Class
 */
class PerfectSPAFramework {
    private config: SPAConfig;
    private eventSource: EventSource | null = null;
    private serviceWorker: ServiceWorkerRegistration | null = null;
    private performanceObserver: PerformanceObserver | null = null;
    private cache: Map<string, any> = new Map();
    private analytics!: AnalyticsService;
    private security!: SecurityService;
    private aiCollaboration!: AICollaborationService;

    constructor(config: Partial<SPAConfig>) {
        this.config = this.mergeWithDefaults(config);
        this.detectEnvironment();
        this.initializeServices();
        this.init();
    }

    /**
     * Environment Detection
     */
    private detectEnvironment(): void {
        const env = typeof window !== 'undefined' ? window : global;
        
        this.config.ai = {
            CLAUDE_CODE: !!(env as any).claude || process.env.CLAUDE_ENV === 'true',
            GEMINI: !!(process.env.GEMINI_API_KEY || process.env.AI_ASSISTANT === 'gemini'),
            HYBRID: process.env.AI_COLLABORATION === 'true',
            environment: (process.env.NODE_ENV as any) || 'development'
        };

        console.log('🤖 AI Environment detected:', this.config.ai);
    }

    /**
     * Service Initialization
     */
    private initializeServices(): void {
        this.analytics = new AnalyticsService(this.config);
        this.security = new SecurityService(this.config.security);
        this.aiCollaboration = new AICollaborationService(this.config.ai);
    }

    /**
     * Main Initialization
     */
    private async init(): Promise<void> {
        try {
            console.log('🚀 Perfect SPA Framework v2.0 initializing...');
            
            // Core initialization
            await this.initializeCore();
            
            // Performance monitoring
            if (this.config.performance.bundleOptimization) {
                this.initPerformanceMonitoring();
            }
            
            // Service Worker
            if (this.config.performance.serviceWorker) {
                await this.initServiceWorker();
            }
            
            // Security setup
            if (this.config.security.csrf || this.config.security.csp) {
                this.security.initialize();
            }
            
            // AI Collaboration
            if (this.config.ai.HYBRID) {
                await this.aiCollaboration.initialize();
            }
            
            // Feature flags
            await this.initializeFeatures();
            
            console.log('✅ Perfect SPA Framework ready!');
            this.analytics.track('spa_initialized', { version: '2.0' });
            
        } catch (error) {
            console.error('❌ SPA Framework initialization failed:', error);
            this.handleError(error as Error, 'initialization');
        }
    }

    /**
     * Core Framework Initialization
     */
    private async initializeCore(): Promise<void> {
        // SSE Connection with retry logic
        await this.initSSEWithRetry();
        
        // Enhanced form handling
        this.initEnhancedForms();
        
        // Smart caching
        this.initSmartCaching();
        
        // Error boundaries
        this.initErrorBoundaries();
    }

    /**
     * Enhanced SSE with retry and reconnection
     */
    private async initSSEWithRetry(maxRetries: number = 5, delay: number = 1000): Promise<void> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.initSSE();
                return; // Success
            } catch (error) {
                console.warn(`SSE connection attempt ${attempt} failed:`, error);
                
                if (attempt === maxRetries) {
                    throw new Error(`SSE connection failed after ${maxRetries} attempts`);
                }
                
                // Exponential backoff
                await this.sleep(delay * Math.pow(2, attempt - 1));
            }
        }
    }

    /**
     * SSE Connection
     */
    private initSSE(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.config.workSetId) {
                console.warn('workSetId not configured, skipping SSE');
                resolve();
                return;
            }

            try {
                this.eventSource = new EventSource(`${this.config.sseUrl}/sse/${this.config.workSetId}`);
                
                const timeout = setTimeout(() => {
                    reject(new Error('SSE connection timeout'));
                }, 10000);

                this.eventSource.onopen = () => {
                    clearTimeout(timeout);
                    console.log('🔗 SSE connection established');
                    this.analytics.track('sse_connected');
                    resolve();
                };

                this.eventSource.onmessage = (event) => {
                    this.handleSSEMessage(JSON.parse(event.data));
                };

                this.eventSource.onerror = (error) => {
                    clearTimeout(timeout);
                    console.error('❌ SSE connection error:', error);
                    this.analytics.track('sse_error', { error: error.toString() });
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
    private initEnhancedForms(): void {
        document.addEventListener('submit', async (event) => {
            const form = event.target as HTMLFormElement;
            
            if (form.hasAttribute('data-spa-ignore')) return;
            
            event.preventDefault();
            
            try {
                // Client-side validation
                const isValid = await this.validateForm(form);
                if (!isValid) return;
                
                // Security checks
                if (this.config.security.sanitization) {
                    this.security.sanitizeFormData(form);
                }
                
                // Submit with analytics
                await this.submitFormWithAnalytics(form);
                
            } catch (error) {
                this.handleError(error as Error, 'form_submission');
            }
        });
    }

    /**
     * Form Validation
     */
    private async validateForm(form: HTMLFormElement): Promise<boolean> {
        const formData = new FormData(form);
        let isValid = true;
        
        // Basic validation
        for (const [key, value] of formData.entries()) {
            if (typeof value === 'string') {
                // XSS prevention
                if (this.security.detectXSS(value)) {
                    this.showNotification(`不正な入力が検出されました: ${key}`, 'error');
                    isValid = false;
                }
                
                // SQL injection prevention
                if (this.security.detectSQLInjection(value)) {
                    this.showNotification(`不正なクエリが検出されました: ${key}`, 'error');
                    isValid = false;
                }
            }
        }
        
        return isValid;
    }

    /**
     * Smart Caching System
     */
    private initSmartCaching(): void {
        const cacheConfig = this.config.performance.caching;
        
        // API response cache
        this.interceptAPIRequests((url: string, response: any) => {
            if (cacheConfig.api > 0) {
                const cacheKey = this.generateCacheKey(url);
                this.cache.set(cacheKey, {
                    data: response,
                    timestamp: Date.now(),
                    ttl: cacheConfig.api * 1000
                });
                
                // Auto-cleanup expired cache
                setTimeout(() => {
                    this.cache.delete(cacheKey);
                }, cacheConfig.api * 1000);
            }
        });
    }

    /**
     * Performance Monitoring
     */
    private initPerformanceMonitoring(): void {
        // Web Vitals monitoring
        if ('PerformanceObserver' in window) {
            this.performanceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.analytics.trackPerformance(entry);
                }
            });
            
            this.performanceObserver.observe({
                entryTypes: ['navigation', 'paint', 'largest-contentful-paint', 'first-input', 'layout-shift']
            });
        }
        
        // Custom performance tracking
        this.trackCustomMetrics();
    }

    /**
     * Service Worker Registration
     */
    private async initServiceWorker(): Promise<void> {
        if ('serviceWorker' in navigator) {
            try {
                this.serviceWorker = await navigator.serviceWorker.register('/sw.js');
                console.log('📦 Service Worker registered:', this.serviceWorker);
                
                this.serviceWorker.addEventListener('updatefound', () => {
                    const newWorker = this.serviceWorker!.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed') {
                                this.showNotification('新しいバージョンが利用可能です', 'info');
                            }
                        });
                    }
                });
                
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    /**
     * Feature Initialization
     */
    private async initializeFeatures(): Promise<void> {
        const features = this.config.features;
        
        // PWA features
        if (features.pwa) {
            await this.initPWA();
        }
        
        // Accessibility features
        if (features.a11y) {
            this.initAccessibility();
        }
        
        // Dark mode
        if (features.darkMode) {
            this.initDarkMode();
        }
        
        // Offline support
        if (features.offline) {
            await this.initOfflineSupport();
        }
    }

    /**
     * Error Handling with AI Collaboration
     */
    private handleError(error: Error, context: string): void {
        const errorInfo: ErrorContext = {
            timestamp: new Date(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            sessionId: this.generateSessionId(),
            aiAssistant: this.getActiveAIAssistant()
        };
        
        console.error(`[${context}] Error:`, error, errorInfo);
        
        // Send to analytics
        this.analytics.trackError(error, errorInfo);
        
        // AI-powered error analysis
        if (this.config.ai.HYBRID) {
            this.aiCollaboration.analyzeError(error, errorInfo);
        }
        
        // User notification
        this.showNotification('エラーが発生しました。しばらくお待ちください。', 'error');
    }

    /**
     * AI Assistant Detection
     */
    private getActiveAIAssistant(): string {
        const ai = this.config.ai;
        if (ai.HYBRID) return 'claude+gemini';
        if (ai.CLAUDE_CODE) return 'claude-code';
        if (ai.GEMINI) return 'gemini';
        return 'none';
    }

    /**
     * Utility Methods
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private generateCacheKey(url: string): string {
        return `spa_cache_${btoa(url)}_${this.config.workSetId}`;
    }

    private generateSessionId(): string {
        return `spa_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private mergeWithDefaults(config: Partial<SPAConfig>): SPAConfig {
        return {
            workSetId: config.workSetId || '',
            baseUrl: config.baseUrl || '',
            sseUrl: config.sseUrl || 'http://localhost:3005',
            debug: config.debug || false,
            ai: config.ai || {} as AIEnvironment,
            performance: {
                bundleOptimization: true,
                lazyLoading: true,
                caching: {
                    api: 300,
                    static: 3600,
                    strategy: 'stale-while-revalidate'
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
    private handleSSEMessage(data: any): void { /* Implementation */ }
    private showNotification(message: string, type: string): void { /* Implementation */ }
    private submitFormWithAnalytics(form: HTMLFormElement): Promise<void> { return Promise.resolve(); }
    private interceptAPIRequests(callback: Function): void { /* Implementation */ }
    private trackCustomMetrics(): void { /* Implementation */ }
    private initPWA(): Promise<void> { return Promise.resolve(); }
    private initAccessibility(): void { /* Implementation */ }
    private initDarkMode(): void { /* Implementation */ }
    private initOfflineSupport(): Promise<void> { return Promise.resolve(); }
    private initErrorBoundaries(): void { /* Implementation */ }
}

/**
 * Supporting Services
 */
class AnalyticsService {
    constructor(private config: SPAConfig) {}
    
    track(event: string, data?: any): void {
        if (this.config.debug) {
            console.log('📊 Analytics:', event, data);
        }
        // Implementation would send to analytics service
    }
    
    trackError(error: Error, context: ErrorContext): void {
        this.track('error', { error: error.message, context });
    }
    
    trackPerformance(entry: PerformanceEntry): void {
        this.track('performance', {
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime
        });
    }
}

class SecurityService {
    constructor(private config: SecurityConfig) {}
    
    initialize(): void {
        if (this.config.csp) {
            this.setupCSP();
        }
        if (this.config.csrf) {
            this.setupCSRF();
        }
    }
    
    detectXSS(input: string): boolean {
        const xssPatterns = [/<script/i, /javascript:/i, /on\w+=/i];
        return xssPatterns.some(pattern => pattern.test(input));
    }
    
    detectSQLInjection(input: string): boolean {
        const sqlPatterns = [/union\s+select/i, /drop\s+table/i, /insert\s+into/i, /delete\s+from/i];
        return sqlPatterns.some(pattern => pattern.test(input));
    }
    
    sanitizeFormData(form: HTMLFormElement): void {
        // Implementation would sanitize form data
    }
    
    private setupCSP(): void {
        // Content Security Policy setup
    }
    
    private setupCSRF(): void {
        // CSRF token setup
    }
}

class AICollaborationService {
    constructor(private ai: AIEnvironment) {}
    
    async initialize(): Promise<void> {
        console.log('🤖 AI Collaboration Service initialized');
    }
    
    async analyzeError(error: Error, context: ErrorContext): Promise<void> {
        if (this.ai.GEMINI) {
            // Would send error analysis request to Gemini
            console.log('🔍 Gemini analyzing error:', error.message);
        }
        
        if (this.ai.CLAUDE_CODE) {
            // Would use Claude Code for error handling suggestions
            console.log('🧠 Claude Code handling error:', error.message);
        }
    }
}

// Global export
declare global {
    interface Window {
        PerfectSPAFramework: typeof PerfectSPAFramework;
        spa: PerfectSPAFramework;
    }
}

if (typeof window !== 'undefined') {
    window.PerfectSPAFramework = PerfectSPAFramework;
}

export default PerfectSPAFramework;