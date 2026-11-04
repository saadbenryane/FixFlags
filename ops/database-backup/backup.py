"""Encrypt a logical PostgreSQL backup before publishing and verify stored bytes."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import parse_qsl, unquote, urlsplit
import uuid

PREFIX = "fixflags/postgres/v1/"
KEY = re.compile(r"^" + re.escape(PREFIX) + r"\d{8}T\d{6}Z-[a-f0-9]{32}\.dump\.age(?:\.json)?$")


def configuration(env):
    required = ["DATABASE_URL", "BACKUP_S3_ENDPOINT", "BACKUP_BUCKET", "BACKUP_AGE_RECIPIENT",
                "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_DEFAULT_REGION"]
    if any(not env.get(name, "").strip() for name in required):
        raise ValueError("Required backup configuration is missing")
    endpoint = urlsplit(env["BACKUP_S3_ENDPOINT"])
    database = urlsplit(env["DATABASE_URL"])
    if endpoint.scheme != "https" or not endpoint.hostname or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment:
        raise ValueError("Backup endpoint must be an explicit HTTPS origin")
    if endpoint.path not in ("", "/") or database.scheme not in ("postgres", "postgresql") or not database.hostname:
        raise ValueError("Backup source or destination is invalid")
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", env["BACKUP_BUCKET"]):
        raise ValueError("Backup bucket must be explicitly named")
    if not re.fullmatch(r"age1[023456789acdefghjklmnpqrstuvwxyz]{58}", env["BACKUP_AGE_RECIPIENT"]):
        raise ValueError("An age X25519 public recipient is required")
    postgres_environment(env)
    days = int(env.get("BACKUP_RETENTION_DAYS", "30"))
    if days < 7 or days > 365:
        raise ValueError("Backup retention must be between 7 and 365 days")
    return {"endpoint": env["BACKUP_S3_ENDPOINT"], "bucket": env["BACKUP_BUCKET"],
            "recipient": env["BACKUP_AGE_RECIPIENT"], "days": days}


def postgres_environment(env):
    source = urlsplit(env["DATABASE_URL"])
    if source.scheme not in ("postgres", "postgresql") or not source.hostname or not source.username or source.fragment:
        raise ValueError("Explicit PostgreSQL connection identity is required")
    values = {"PGHOST": unquote(source.hostname), "PGPORT": str(source.port or 5432),
              "PGDATABASE": unquote(source.path.lstrip("/")), "PGUSER": unquote(source.username),
              "PGPASSWORD": unquote(source.password or ""), "PGCONNECT_TIMEOUT": "30"}
    if not values["PGDATABASE"]:
        raise ValueError("Explicit PostgreSQL database is required")
    options = {"sslmode": "PGSSLMODE", "sslrootcert": "PGSSLROOTCERT", "sslcert": "PGSSLCERT",
               "sslkey": "PGSSLKEY", "channel_binding": "PGCHANNELBINDING", "options": "PGOPTIONS",
               "connect_timeout": "PGCONNECT_TIMEOUT", "application_name": "PGAPPNAME",
               "target_session_attrs": "PGTARGETSESSIONATTRS", "gssencmode": "PGGSSENCMODE"}
    seen = set()
    for name, value in parse_qsl(source.query, keep_blank_values=True):
        if name not in options or name in seen:
            raise ValueError("Unsupported or duplicate PostgreSQL connection option")
        seen.add(name)
        values[options[name]] = value
    # libpq environment defaults do not expand a URL stored in PGDATABASE.
    # Decode its fields explicitly while keeping credentials out of process argv.
    return dict({key: value for key, value in env.items() if not key.startswith("PG")}, **values)


class Commands:
    def run(self, arguments):
        result = subprocess.run(arguments, capture_output=True, timeout=1800, check=True)
        return result.stdout

    def encrypt_dump(self, destination, recipient):
        # The URL stays out of argv, logs and the archive. libpq reads it here.
        env = postgres_environment(os.environ)
        with destination.open("wb") as output:
            dump = subprocess.Popen(["pg_dump", "--format=custom", "--no-owner"],
                                    env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            try:
                encrypted = subprocess.Popen(["age", "--encrypt", "--recipient", recipient],
                                             stdin=dump.stdout, stdout=output, stderr=subprocess.DEVNULL)
                dump.stdout.close()
                try:
                    if encrypted.wait(timeout=1800) != 0 or dump.wait(timeout=30) != 0:
                        raise RuntimeError("Encrypted dump did not complete")
                finally:
                    if encrypted.poll() is None:
                        encrypted.kill()
                    encrypted.wait()
            finally:
                if dump.poll() is None:
                    dump.kill()
                dump.wait()

    def remote_digest(self, arguments):
        # Bound the whole download, including a provider that stops sending bytes.
        with tempfile.TemporaryFile() as output:
            subprocess.run(arguments, stdout=output, stderr=subprocess.DEVNULL,
                           timeout=1800, check=True)
            output.seek(0)
            digest = hashlib.sha256()
            size = 0
            while chunk := output.read(1024 * 1024):
                digest.update(chunk)
                size += len(chunk)
            return size, digest.hexdigest()

    def postgres_major(self):
        result = subprocess.run(["psql", "-XAt", "--no-password", "--command",
                                 "SELECT current_setting('server_version_num')"],
                                env=postgres_environment(os.environ),
                                capture_output=True, timeout=30, check=True)
        return int(result.stdout.strip()) // 10000


def file_digest(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return path.stat().st_size, digest.hexdigest()


def publish(config, commands, now):
    major = commands.postgres_major()
    if major > 18 or major < 14:
        raise ValueError("Backup client does not support the selected server version")
    aws = ["aws", "--endpoint-url", config["endpoint"]]
    key = PREFIX + now.strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex + ".dump.age"
    uri = "s3://" + config["bucket"] + "/"
    # Plaintext is piped directly into age. Only encrypted bytes touch disk.
    with tempfile.TemporaryDirectory(prefix="fixflags-encrypted-backup-") as directory:
        os.chmod(directory, 0o700)
        path = Path(directory) / "database.dump.age"
        commands.encrypt_dump(path, config["recipient"])
        size, digest = file_digest(path)
        if not size:
            raise RuntimeError("Encrypted dump is empty")
        commands.run(aws + ["s3", "cp", str(path), uri + key, "--only-show-errors"])
        if commands.remote_digest(aws + ["s3", "cp", uri + key, "-", "--only-show-errors"]) != (size, digest):
            raise RuntimeError("Stored backup bytes did not match the encrypted dump")
        manifest = {"version": 1, "createdAt": now.isoformat(), "key": key, "bytes": size,
                    "sha256": digest, "format": "pg_dump-custom+age-x25519", "postgresMajor": major,
                    "recipientSha256": hashlib.sha256(config["recipient"].encode()).hexdigest()}
        proof = Path(directory) / "manifest.json"
        proof.write_text(json.dumps(manifest) + "\n")
        commands.run(aws + ["s3", "cp", str(proof), uri + key + ".json", "--only-show-errors"])
        stored = json.loads(commands.run(aws + ["s3", "cp", uri + key + ".json", "-", "--only-show-errors"]))
        if stored != manifest:
            raise RuntimeError("Stored backup manifest did not match")
        # Prune only this job's named objects, after a new verified pair exists.
        listing = json.loads(commands.run(aws + ["s3api", "list-objects-v2", "--bucket", config["bucket"], "--prefix", PREFIX]))
        cutoff = now - dt.timedelta(days=config["days"])
        deleted = 0
        for item in listing.get("Contents", []):
            item_key = item["Key"]
            if not KEY.fullmatch(item_key) or item_key in (key, key + ".json"):
                continue
            modified = dt.datetime.fromisoformat(item["LastModified"].replace("Z", "+00:00"))
            if modified < cutoff:
                commands.run(aws + ["s3api", "delete-object", "--bucket", config["bucket"], "--key", item_key])
                deleted += 1
        return {"createdAt": manifest["createdAt"], "bytes": size, "sha256": digest,
                "verified": True, "prunedObjects": deleted, "retentionDays": config["days"]}


if __name__ == "__main__":
    try:
        config = configuration(os.environ)
        print(json.dumps(publish(config, Commands(), dt.datetime.now(dt.timezone.utc))))
    except Exception:
        # Provider errors and libpq diagnostics can contain credentials or source details.
        print(json.dumps({"verified": False, "error": "Database backup failed; no success receipt issued"}))
        raise SystemExit(1)
