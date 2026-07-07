# KEYIMA backend (บริการรวม storefront + admin) — สำหรับ Render
FROM node:22-slim

WORKDIR /app

# root CA certificates — จำเป็นสำหรับ libsql/Turso ต่อ TLS ขึ้นคลาวด์
# (node:22-slim ไม่มี ca-certificates ติดมา → ไม่งั้น error "TLS error: no valid native root CA certificates found")
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV SSL_CERT_DIR=/etc/ssl/certs

# ติดตั้ง dependencies ก่อน (cache layer)
COPY db/package*.json ./db/
COPY be/package*.json ./be/
RUN cd db && npm install --omit=dev && cd ../be && npm install --omit=dev

# คัดลอกซอร์สที่เหลือ
COPY db ./db
COPY be ./be
COPY fe ./fe
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# DB_PATH = ไฟล์แคช local (embedded replica); ข้อมูลจริงถาวรอยู่บน Turso
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/tmp/shop.db
EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
