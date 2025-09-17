help:
	@echo "Available targets:"
	@echo "  make serve   # Serve at http://localhost:5173 using python3"
	@echo "  make open    # Open http://localhost:5173 in default browser"

serve:
	python3 -m http.server 5173

open:
	@open http://localhost:5173 2>/dev/null || xdg-open http://localhost:5173 2>/dev/null || echo "Open the URL: http://localhost:5173"

