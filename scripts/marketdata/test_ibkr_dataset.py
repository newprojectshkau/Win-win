import unittest
from datetime import date, datetime, timezone
from types import SimpleNamespace

from build_ibkr_dataset import convert_sessions


def bar(timestamp, close=205):
    return SimpleNamespace(date=timestamp, open=204, high=210, low=202, close=close, volume=1000)


class ConvertIBKRHistory(unittest.TestCase):
    def test_dst_alignment_with_prior_close_and_missing_session(self):
        days = ["2026-10-30", "2026-11-02", "2026-11-03"]
        template = [{"date": day} for day in days]
        first = bar(datetime(2026, 10, 30, 13, 30, tzinfo=timezone.utc))
        second = bar(datetime(2026, 11, 2, 14, 30, tzinfo=timezone.utc))
        sessions = convert_sessions(template, [second, first, first],
                                    [bar(date(2026, 10, 30)), bar(date(2026, 11, 2), 206)])
        self.assertEqual(len(sessions[0]["bars"]), 1)
        self.assertEqual(sessions[1]["previousClose"], 205)
        self.assertEqual(sessions[1]["bars"][0]["availableAt"], "2026-11-02T14:31:00+00:00")
        self.assertIsNone(sessions[2]["bars"])
        self.assertIsNone(sessions[2]["daily"])

    def test_rejects_future_cap_or_conflicting_repeated_minute(self):
        template = [{"date": "2026-11-02", "marketCap": 5e9,
                     "marketCapAvailableAt": "2026-11-02T21:01:00+00:00"}]
        stamp = datetime(2026, 11, 2, 14, 30, tzinfo=timezone.utc)
        with self.assertRaisesRegex(ValueError, "unavailable"):
            convert_sessions(template, [bar(stamp)], [])
        with self.assertRaisesRegex(ValueError, "conflicting"):
            convert_sessions(template, [bar(stamp), bar(stamp, 206)], [])
