import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient

os.environ['TELEGRAM_BOT_TOKEN'] = 'test-token'
os.environ['TELEGRAM_CHAT_ID'] = 'test-chat'
os.environ['ALLOWED_HOSTS'] = 'localhost,127.0.0.1'

from app.main import app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        os.environ['LEAD_ARCHIVE_PATH'] = str(Path(self.temp.name) / 'leads.jsonl')
        os.environ['TELEGRAM_BOT_TOKEN'] = 'test-token'
        os.environ['TELEGRAM_CHAT_ID'] = 'test-chat'
        self.client = TestClient(app, base_url='http://localhost')

    def tearDown(self):
        self.temp.cleanup()

    def test_health(self):
        self.assertEqual(self.client.get('/health').json(), {'status': 'ok'})

    def test_rejects_unsupported_method(self):
        response = self.client.get('/api/lead')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.headers['allow'], 'POST')

    def test_rejects_invalid_email(self):
        response = self.client.post('/api/lead', json={'email': 'invalid'})
        self.assertEqual(response.status_code, 400)

    def test_honeypot_returns_success_without_delivery(self):
        response = self.client.post('/api/lead', json={'email': 'bot@example.com', 'website': 'filled'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'ok': True, 'delivery': 'filtered'})

    @patch('app.api.routes.send_message', new_callable=AsyncMock)
    def test_accepts_json_and_archives(self, delivery):
        response = self.client.post('/api/lead', json={'email': 'lead@example.com', 'name': 'Lead'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['delivery'], 'telegram')
        self.assertTrue(Path(os.environ['LEAD_ARCHIVE_PATH']).is_file())
        delivery.assert_awaited_once()

    @patch('app.api.routes.send_message', new_callable=AsyncMock)
    def test_accepts_urlencoded_and_multipart_forms(self, delivery):
        urlencoded = self.client.post('/api/lead', data={'email': 'form@example.com'})
        multipart = self.client.post('/api/lead', files={'email': (None, 'multi@example.com')})
        self.assertEqual(urlencoded.status_code, 200)
        self.assertEqual(multipart.status_code, 200)
        self.assertEqual(delivery.await_count, 2)

    def test_rejects_oversized_body(self):
        response = self.client.post('/api/lead', content=b'x' * 12001, headers={'content-type': 'application/json'})
        self.assertEqual(response.status_code, 413)

    def test_rejects_invalid_origin(self):
        response = self.client.post('/api/lead', json={'email': 'lead@example.com'}, headers={'origin': 'https://attacker.example'})
        self.assertEqual(response.status_code, 403)

    @patch('app.api.routes.send_message', new_callable=AsyncMock)
    def test_accepts_valid_origin_and_missing_optional_fields(self, delivery):
        response = self.client.post('/api/lead', json={'email': 'lead@example.com'}, headers={'origin': 'http://localhost'})
        self.assertEqual(response.status_code, 200)
        delivery.assert_awaited_once()

    @patch('app.api.routes.send_message', new_callable=AsyncMock)
    def test_telegram_failure_keeps_archived_lead(self, delivery):
        delivery.side_effect = httpx.ConnectError('offline')
        response = self.client.post('/api/lead', json={'email': 'saved@example.com'})
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json(), {'ok': True, 'delivery': 'archived'})
        self.assertTrue(Path(os.environ['LEAD_ARCHIVE_PATH']).is_file())

    @patch('app.api.routes.send_message', new_callable=AsyncMock)
    def test_plain_html_submit_redirects(self, delivery):
        response = self.client.post(
            '/api/lead',
            data={'email': 'html@example.com'},
            headers={'accept': 'text/html', 'referer': 'http://localhost/ru/'},
            follow_redirects=False
        )
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers['location'], '/ru/#sent')


if __name__ == '__main__':
    unittest.main()
