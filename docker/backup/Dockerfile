# Layanan cadangan: pg_dump terjadwal + rclone opsional.
# Berbasis image postgres agar versi pg_dump selalu cocok dengan server.
FROM postgres:16-alpine

RUN apk add --no-cache rclone

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

VOLUME ["/backups"]
ENTRYPOINT ["/usr/local/bin/backup.sh"]
