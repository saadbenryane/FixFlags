FROM postgres:18-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends age awscli python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY ops/database-backup/backup.py /opt/fixflags/backup.py

# This job has no application, queue worker, mailbox or decryption key.
ENTRYPOINT ["python3", "/opt/fixflags/backup.py"]
