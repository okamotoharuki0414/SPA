#!/usr/bin/env python3
"""
Simple Perfect SPA Server
"""

import http.server
import socketserver
import os
from pathlib import Path

PORT = 9000
DEMO_DIR = Path(__file__).parent

class SimpleHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DEMO_DIR), **kwargs)
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    
    def do_GET(self):
        if self.path == '/' or self.path == '':
            self.path = '/demo-perfect.html'
        super().do_GET()

if __name__ == "__main__":
    try:
        with socketserver.TCPServer(("", PORT), SimpleHandler) as httpd:
            print(f"🚀 Perfect SPA Demo: http://localhost:{PORT}")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
    except Exception as e:
        print(f"❌ Error: {e}")