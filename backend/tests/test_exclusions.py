"""The agreed exclusions stay excluded: no online payment, no video consultation, no SMS or WhatsApp sending
from recall and offers. (Patient sign-up codes use the SMS hook only when a gateway is configured.)"""
import re
from datetime import date, timedelta

from app.main import app
from tests.test_clinic_app import logins

FORBIDDEN = re.compile(r"checkout|top-?up|razorpay|stripe|paytm|phonepe|payment-gateway|pay-now|paynow|refund|video|whatsapp|wallet/add|/buy|purchase-plan", re.I)


def test_no_payment_video_or_messaging_endpoints():
    paths = sorted(app.openapi()["paths"])
    offending = [p for p in paths if FORBIDDEN.search(p)]
    assert not offending, offending
    # recording a payment taken at the desk is allowed; there is no endpoint that charges a card or wallet
    assert "/api/payments" in paths


def test_outbound_calls_are_only_the_configured_hooks():
    import pathlib
    calls = []
    for f in pathlib.Path("app").rglob("*.py"):
        for n, line in enumerate(f.read_text().splitlines(), 1):
            if "urlopen(" in line or "httpx." in line or "requests.post" in line:
                calls.append(f"{f}:{n}")
    # email codes, SMS codes and push: each a webhook the operator configures (see docs/INTEGRATIONS.md)
    assert sorted(c.split(":")[0] for c in calls) == sorted(["app/email_codes.py", "app/notify.py", "app/otp.py"]), calls


async def test_recall_and_offers_never_use_sms_or_whatsapp(http, monkeypatch):
    import app.otp as otp
    import app.email_codes as email_codes

    def boom(*args, **kwargs):
        raise AssertionError("an outside message was sent")

    monkeypatch.setattr(otp, "_post_webhook", boom)
    monkeypatch.setattr(email_codes, "_post_webhook", boom)
    owner, reception, _ = await logins(http)
    patient = (await http.get("/api/clinic-app/patients?q=DEN-1001", headers=owner)).json()["items"][0]
    sent = await http.post("/api/clinic-app/recall", headers=reception, json={"patient_id": patient["id"], "message": "Hi [Patient Name], time for your check-up."})
    assert sent.status_code == 201 and sent.json()["channel"] in ("Patient app", "Not sent: no patient app")
    till = (date.today() + timedelta(days=10)).isoformat()
    offer = await http.post("/api/engage/offers", headers=owner, json={"title": "Exclusion check", "kind": "general", "discount_type": "amount", "value": 100, "valid_till": till})
    assert offer.status_code == 201
    # bookings from the app are paid at the clinic: the booking has no payment step and no amount due online
    plans = (await http.get("/api/engage/plans", headers=owner)).json()
    assert all("price" in p for p in plans["plans"])  # shown, not sold
    wallet = (await http.get("/api/engage/wallet", headers=owner)).json()
    assert set(wallet) >= {"points", "code"} and "balance" not in wallet
