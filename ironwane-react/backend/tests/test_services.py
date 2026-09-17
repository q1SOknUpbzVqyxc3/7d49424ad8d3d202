import unittest

from app.services.archive import mask_ip
from app.services.telegram import render_message


class ServiceTests(unittest.TestCase):
    def test_masks_ipv4_and_ipv6(self):
        self.assertEqual(mask_ip('203.0.113.47'), '203.0.113.0')
        self.assertEqual(mask_ip('2001:db8:abcd:12::1'), '2001:db8:abcd:12::')

    def test_renders_escaped_lead(self):
        message = render_message({'email': 'a@example.com', 'name': '<Admin>'}, '/en/', 'GB')
        self.assertIn('&lt;Admin&gt;', message)
        self.assertIn('a@example.com', message)
        self.assertIn('GB', message)


if __name__ == '__main__':
    unittest.main()
