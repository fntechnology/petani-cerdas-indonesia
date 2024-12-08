import http.server
import socketserver
import os
import socket

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port

PORT = find_free_port()

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        return super().end_headers()

    def guess_type(self, path):
        # Handle content types
        if path.endswith('.js'):
            return 'application/javascript'
        if path.endswith('.html'):
            return 'text/html'
        if path.endswith('.css'):
            return 'text/css'
        return super().guess_type(path)

    def do_GET(self):
        # Serve index.html for root path
        if self.path == '/':
            self.path = '/index.html'
        return super().do_GET()

print(f"Server berjalan di http://localhost:{PORT}")
print("Tekan Ctrl+C untuk menghentikan server")

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan")
