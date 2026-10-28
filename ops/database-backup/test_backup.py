import datetime as dt
import hashlib
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import backup

NOW = dt.datetime(2026, 10, 28, 22, 0, tzinfo=dt.timezone.utc)
RECIPIENT = 'age1' + 'a' * 58
CONFIG = {'endpoint': 'https://fixture.invalid', 'bucket': 'fixture-backup', 'recipient': RECIPIENT, 'days': 30}
OLD = backup.PREFIX + '20260901T000000Z-' + 'a' * 32 + '.dump.age'


class Store:
    def __init__(self):
        self.objects = {}
        self.events = []
        self.corrupt = False
        self.dump_failure = False
        self.manifest_failure = False
        self.objects[OLD] = b'old encrypted backup'
        self.objects[OLD + '.json'] = b'old manifest'
        self.objects[backup.PREFIX + 'unrecognized'] = b'retained foreign object'
        self.objects['another/old.dump.age'] = b'unrelated object'

    def postgres_major(self):
        return 18

    def encrypt_dump(self, path, recipient):
        if self.dump_failure:
            raise RuntimeError('source interrupted')
        self.events.append('encrypt')
        path.write_bytes(b'age-encrypted fixture bytes')

    def remote_digest(self, arguments):
        key = arguments[-3].split('/fixture-backup/')[1]
        value = self.objects[key] + (b'corrupted' if self.corrupt else b'')
        self.events.append('verify-ciphertext')
        return len(value), hashlib.sha256(value).hexdigest()

    def run(self, arguments):
        command = arguments[3:]
        if command[:2] == ['s3', 'cp']:
            source, destination = command[2:4]
            if destination == '-':
                self.events.append('verify-manifest')
                if self.manifest_failure:
                    return b'{}'
                return self.objects[source.split('/fixture-backup/')[1]]
            key = destination.split('/fixture-backup/')[1]
            self.objects[key] = Path(source).read_bytes()
            self.events.append('publish-manifest' if key.endswith('.json') else 'publish-ciphertext')
            return b''
        if command[:2] == ['s3api', 'list-objects-v2']:
            self.events.append('list')
            return json.dumps({'Contents': [{'Key': key, 'LastModified': '2026-09-01T00:00:00Z'} for key in self.objects]}).encode()
        if command[:2] == ['s3api', 'delete-object']:
            self.events.append('delete')
            del self.objects[command[-1]]
            return b'{}'
        raise AssertionError(arguments)


class BackupTests(unittest.TestCase):
    def test_verifies_ciphertext_and_manifest_before_pruning_only_owned_names(self):
        store = Store()
        result = backup.publish(CONFIG, store, NOW)
        self.assertTrue(result['verified'])
        self.assertEqual(result['prunedObjects'], 2)
        self.assertLess(store.events.index('verify-ciphertext'), store.events.index('publish-manifest'))
        self.assertLess(store.events.index('verify-manifest'), store.events.index('delete'))
        self.assertIn('another/old.dump.age', store.objects)
        self.assertIn(backup.PREFIX + 'unrecognized', store.objects)
        self.assertEqual(len([key for key in store.objects if key.endswith('.dump.age')]), 2)

    def test_failed_dump_never_publishes_or_prunes(self):
        store = Store()
        store.dump_failure = True
        with self.assertRaises(RuntimeError):
            backup.publish(CONFIG, store, NOW)
        self.assertEqual(store.events, [])
        self.assertIn(OLD, store.objects)

    def test_corrupt_remote_bytes_never_publish_a_success_manifest_or_prune(self):
        store = Store()
        store.corrupt = True
        with self.assertRaisesRegex(RuntimeError, 'Stored backup bytes'):
            backup.publish(CONFIG, store, NOW)
        self.assertNotIn('publish-manifest', store.events)
        self.assertNotIn('delete', store.events)
        self.assertIn(OLD, store.objects)

    def test_corrupt_remote_manifest_never_prunes(self):
        store = Store()
        store.manifest_failure = True
        with self.assertRaisesRegex(RuntimeError, 'Stored backup manifest'):
            backup.publish(CONFIG, store, NOW)
        self.assertNotIn('delete', store.events)
        self.assertIn(OLD, store.objects)

    def test_rejects_destination_credentials_and_unbounded_retention(self):
        env = {'DATABASE_URL': 'postgresql://fixture:fixture@db.invalid/fixture',
               'BACKUP_S3_ENDPOINT': CONFIG['endpoint'], 'BACKUP_BUCKET': CONFIG['bucket'],
               'BACKUP_AGE_RECIPIENT': RECIPIENT, 'AWS_ACCESS_KEY_ID': 'fixture', 'AWS_SECRET_ACCESS_KEY': 'fixture', 'AWS_DEFAULT_REGION': 'us-east-1'}
        self.assertEqual(backup.configuration(env)['days'], 30)
        for name, value in [('BACKUP_S3_ENDPOINT', 'http://fixture.invalid'),
                            ('BACKUP_S3_ENDPOINT', 'https://secret@fixture.invalid'),
                            ('BACKUP_S3_ENDPOINT', 'https://fixture.invalid/path'),
                            ('BACKUP_BUCKET', '../other'), ('BACKUP_AGE_RECIPIENT', 'not-a-recipient'),
                            ('BACKUP_RETENTION_DAYS', '0')]:
            with self.subTest(name=name, value=value), self.assertRaises(ValueError):
                backup.configuration(dict(env, **{name: value}))

    def test_libpq_receives_decoded_identity_and_security_options_without_url_in_argv(self):
        env = backup.postgres_environment({'DATABASE_URL': 'postgresql://backup%2Buser:p%40ss%3Aword@db.invalid:5433/owned%2Bdb?sslmode=verify-full&application_name=backup', 'PGSERVICE': 'unrelated'})
        self.assertEqual(env['PGHOST'], 'db.invalid')
        self.assertEqual(env['PGPORT'], '5433')
        self.assertEqual(env['PGUSER'], 'backup+user')
        self.assertEqual(env['PGPASSWORD'], 'p@ss:word')
        self.assertEqual(env['PGDATABASE'], 'owned+db')
        self.assertEqual(env['PGSSLMODE'], 'verify-full')
        self.assertEqual(env['PGAPPNAME'], 'backup')
        self.assertNotIn('PGSERVICE', env)
        for query in ['sslmode=require&sslmode=disable', 'unknown=ignored']:
            with self.assertRaises(ValueError):
                backup.postgres_environment({'DATABASE_URL': 'postgresql://user:password@db.invalid/fixture?' + query})

    def test_download_deadline_covers_a_stalled_provider(self):
        with patch('backup.subprocess.run', side_effect=TimeoutError) as run:
            with self.assertRaises(TimeoutError):
                backup.Commands().remote_digest(['fixture-downloader'])
            self.assertEqual(run.call_args.kwargs['timeout'], 1800)

    def test_temporary_ciphertext_is_deleted_after_a_failed_upload(self):
        store = Store()
        captured = []
        original = store.encrypt_dump
        def encrypt(path, recipient):
            captured.append(path)
            original(path, recipient)
        store.encrypt_dump = encrypt
        store.run = lambda _: (_ for _ in ()).throw(RuntimeError('upload failed'))
        with self.assertRaises(RuntimeError):
            backup.publish(CONFIG, store, NOW)
        self.assertFalse(captured[0].exists())


if __name__ == '__main__':
    unittest.main()
