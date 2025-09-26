#!/usr/bin/env python3
"""
Perfect SPA Framework v2.0 Demo Server
AI協力による次世代SPAシステム
"""

import http.server
import socketserver
import os
import sys
import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# サーバー設定
PORT = 9000
DEMO_DIR = Path(__file__).parent

class PerfectSPAHandler(http.server.SimpleHTTPRequestHandler):
    """Perfect SPA Framework v2.0 用のカスタムハンドラー"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DEMO_DIR), **kwargs)
    
    def end_headers(self):
        # Enhanced CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-AI-Assistant')
        self.send_header('Access-Control-Expose-Headers', 'X-Performance-Metrics, X-AI-Analysis')
        
        # Security headers
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        
        # Performance headers
        if self.path.endswith(('.js', '.css')):
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        elif self.path.endswith('.html'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            
        # AI Environment headers
        self.send_header('X-AI-Claude', 'active')
        self.send_header('X-AI-Gemini', 'available')
        self.send_header('X-AI-Collaboration', 'enabled')
        
        super().end_headers()
    
    def do_OPTIONS(self):
        """CORS プリフライトリクエストの処理"""
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        """Enhanced GET request handling"""
        parsed_url = urlparse(self.path)
        
        # API endpoints simulation
        if parsed_url.path.startswith('/api/'):
            self.handle_api_request(parsed_url)
            return
            
        # Performance metrics endpoint
        if parsed_url.path == '/metrics':
            self.handle_metrics_request()
            return
            
        # Health check with AI status
        if parsed_url.path == '/health':
            self.handle_health_check()
            return
            
        # Service Worker
        if parsed_url.path == '/sw.js':
            self.serve_service_worker()
            return
            
        # Manifest for PWA
        if parsed_url.path == '/manifest.json':
            self.serve_manifest()
            return
        
        # Real System SPA routing
        if self.path == '/shift-system' or self.path == '/shift':
            self.path = '/shift-system-spa.html'
        
        # Default SPA routing
        elif self.path != '/' and not os.path.exists(os.path.join(DEMO_DIR, self.path.lstrip('/'))):
            if not self.path.startswith('/api/') and '.' not in self.path:
                self.path = '/demo-perfect.html'
        
        super().do_GET()
    
    def handle_api_request(self, parsed_url):
        """Simulate API responses with AI collaboration"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('X-AI-Analysis', 'claude-code-processed')
        self.end_headers()
        
        # Simulate AI-enhanced API response
        response = {
            'success': True,
            'data': {
                'message': 'Perfect SPA API endpoint',
                'timestamp': '2025-09-26T10:30:00Z',
                'ai_enhancement': {
                    'claude_optimization': True,
                    'gemini_analysis': False,  # Simulated
                    'performance_score': 95
                }
            },
            'meta': {
                'version': '2.0.0',
                'ai_collaboration': 'active'
            }
        }
        
        self.wfile.write(json.dumps(response, indent=2).encode('utf-8'))
    
    def handle_metrics_request(self):
        """Performance metrics endpoint"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        metrics = {
            'performance': {
                'bundle_size': '6.04 KB',
                'load_time': 245,
                'memory_usage': 12.5,
                'cache_hit_rate': 0.89
            },
            'security': {
                'csp_violations': 0,
                'xss_attempts': 0,
                'csrf_tokens': 'valid'
            },
            'ai_collaboration': {
                'claude_active': True,
                'gemini_available': False,
                'optimization_suggestions': 3
            }
        }
        
        self.wfile.write(json.dumps(metrics, indent=2).encode('utf-8'))
    
    def handle_health_check(self):
        """Enhanced health check with AI status"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        health_status = {
            'status': 'healthy',
            'version': '2.0.0',
            'timestamp': '2025-09-26T10:30:00Z',
            'services': {
                'spa_framework': 'active',
                'performance_monitoring': 'active',
                'security_layer': 'active'
            },
            'ai_collaboration': {
                'claude_code': 'active',
                'gemini': 'standby',
                'hybrid_mode': 'enabled'
            }
        }
        
        self.wfile.write(json.dumps(health_status, indent=2).encode('utf-8'))
    
    def serve_service_worker(self):
        """Serve Service Worker for PWA functionality"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/javascript')
        self.end_headers()
        
        sw_content = '''
// Perfect SPA Framework v2.0 Service Worker
const CACHE_NAME = 'perfect-spa-v2.0';
const urlsToCache = [
    '/demo-perfect.html',
    '/dist/spa-framework-perfect.iife.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'AI_ANALYSIS') {
        console.log('AI analysis received:', event.data.payload);
    }
});
'''
        
        self.wfile.write(sw_content.encode('utf-8'))
    
    def serve_manifest(self):
        """Serve PWA manifest"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        manifest = {
            'name': 'Perfect SPA Framework v2.0',
            'short_name': 'Perfect SPA',
            'description': 'AI協力による次世代SPA',
            'start_url': '/demo-perfect.html',
            'display': 'standalone',
            'background_color': '#007bff',
            'theme_color': '#007bff',
            'icons': [
                {
                    'src': '/icons/icon-192.png',
                    'sizes': '192x192',
                    'type': 'image/png'
                }
            ]
        }
        
        self.wfile.write(json.dumps(manifest, indent=2).encode('utf-8'))
    
    def log_message(self, format, *args):
        """Enhanced logging with AI context"""
        ai_header = self.headers.get('X-AI-Assistant', 'none')
        print(f"[{self.log_date_time_string()}] [{ai_header}] {format % args}")

def main():
    """メイン関数"""
    try:
        # Perfect SPA ディレクトリの確認
        if not DEMO_DIR.exists():
            print(f"❌ Error: Perfect SPA directory not found: {DEMO_DIR}")
            sys.exit(1)
        
        # demo-perfect.html の確認
        demo_file = DEMO_DIR / 'demo-perfect.html'
        if not demo_file.exists():
            print(f"❌ Error: demo-perfect.html not found: {demo_file}")
            sys.exit(1)
        
        # dist ディレクトリの確認
        dist_dir = DEMO_DIR / 'dist'
        if not dist_dir.exists():
            print(f"⚠️  Warning: dist directory not found. Run 'npm run build' first.")
        
        # サーバー起動
        with socketserver.TCPServer(("", PORT), PerfectSPAHandler) as httpd:
            print("=" * 80)
            print("🚀 Perfect SPA Framework v2.0 Demo Server")
            print("=" * 80)
            print(f"📁 Serving directory: {DEMO_DIR}")
            print(f"🌐 Server address: http://localhost:{PORT}")
            print(f"🎯 Perfect Demo: http://localhost:{PORT}/demo-perfect.html")
            print(f"📊 Health Check: http://localhost:{PORT}/health")
            print(f"📈 Metrics: http://localhost:{PORT}/metrics")
            print("=" * 80)
            print("🤖 AI Collaboration Features:")
            print("   • Claude Code: Active")
            print("   • Gemini: Standby")
            print("   • Hybrid Mode: Enabled")
            print("=" * 80)
            print("⏹️  Press Ctrl+C to stop the server")
            print("-" * 80)
            
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\n" + "=" * 80)
                print("🛑 Perfect SPA Demo Server stopped by user")
                print("🎉 Thank you for using Perfect SPA Framework v2.0!")
                print("=" * 80)
                
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ Error: Port {PORT} is already in use.")
            print(f"💡 Try using a different port or stop the process using port {PORT}")
            print(f"🔍 Check running processes: lsof -ti:{PORT}")
        else:
            print(f"❌ Error starting server: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()