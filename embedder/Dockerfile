# Dịch vụ tính vector ảnh (CLIP) cho tìm homestay theo ảnh.
# Nền Debian (glibc) vì onnxruntime-node không có bản cho Alpine/musl. Mô hình được tải SẴN lúc build
# (nằm trong ảnh) ⇒ chạy không cần mạng, khởi động là nạp thẳng vào RAM và giữ thường trực.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.mjs ./
ENV MODEL_DIR=/app/models
RUN node server.mjs --download
EXPOSE 8790
CMD ["node", "server.mjs"]
