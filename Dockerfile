# KEYIMA backend (บริการรวม storefront + admin) — สำหรับ Render
FROM node:22-slim

WORKDIR /app

# ติดตั้ง dependencies ก่อน (cache layer)
COPY db/package*.json ./db/
COPY be/package*.json ./be/
RUN cd db && npm install --omit=dev && cd ../be && npm install --omit=dev

# คัดลอกซอร์สที่เหลือ
COPY db ./db
COPY be ./be
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# DB_PATH = ไฟล์แคช local (embedded replica); ข้อมูลจริงถาวรอยู่บน Turso
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/tmp/shop.db
EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
