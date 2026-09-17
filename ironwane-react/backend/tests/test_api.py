import os
import unittest

from fastapi.testclient import TestClient

os.environ['TELEGRAM_BOT_TOKEN'] = 'test-token'
os.environ['TELEGRAM_CHAT_ID'] = 'test-chat'

from app.main import app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, base_url='http://localhost')

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
        self.assertEqual(response.json(), {'ok': True})


if __name__ == '__main__':
    unittest.main()
