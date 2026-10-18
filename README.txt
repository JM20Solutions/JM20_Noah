Noah site: template + finalizer (only needed if a URL changes)
  python3 finalize.py --origin https://noah.jm20aisolutions.com --parent https://jm20aisolutions.com \
    --legal https://jm20aisolutions.com/terminos-de-servicio --privacy https://jm20aisolutions.com/politica-de-privacidad \
    --legal-en https://jm20aisolutions.com/terms-of-service --privacy-en https://jm20aisolutions.com/privacy-policy --out site
Deploy the generated site/ folder (never site-template/). Requires: pip install segno
