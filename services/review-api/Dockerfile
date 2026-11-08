FROM python:3.12-slim
WORKDIR /app
COPY server.py /app/server.py
RUN useradd --uid 10001 --create-home demo && mkdir /data && chown demo /data
USER demo
ENV PORT=8080 DATABASE_PATH=/data/reviews.sqlite3 COOKIE_SECURE=true
EXPOSE 8080
CMD ["python", "/app/server.py"]
