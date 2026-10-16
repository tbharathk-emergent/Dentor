"""Clinic app accounts: dashboard, expenses, invoices, receipts, statement, Dentor accounts (app/routers/clinic_accounts.py)."""
from datetime import date, timedelta

from tests.test_apps import ADMIN, staff_headers
from tests.test_clinic_app import logins
from tests.test_consult import setup as consult_setup, CASE, free


async def test_expenses_are_finance_only_and_checked(http):
    owner, reception, accountant = await logins(http)
    today = date.today().isoformat()
    assert (await http.get("/api/expenses", headers=reception)).status_code == 403
    assert (await http.get("/api/clinic-app/accounts/summary", headers=reception)).status_code == 403
    bad = [{"category": "Party", "amount": 100, "payee": "X"}, {"category": "Domestic", "amount": 0, "payee": "X"},
           {"category": "Domestic", "amount": 100, "payee": ""}, {"category": "Domestic", "amount": 100, "payee": "X", "mode": "Bitcoin"}]
    for body in bad:
        assert (await http.post("/api/expenses", headers=accountant, json=body)).status_code == 400, body
    rent = await http.post("/api/expenses", headers=accountant, json={"category": "Domestic", "amount": "15000", "payee": "Landlord", "description": "Rent", "mode": "Bank Transfer", "date": today})
    assert rent.status_code in (200, 201), rent.text
    assert rent.json()["code"].startswith("EXP-") and rent.json()["amount"] == 15000
    listed = (await http.get("/api/clinic-app/accounts/expenses?category=Domestic", headers=accountant)).json()
    assert any(x["code"] == rent.json()["code"] and x["source"] == "Recorded" for x in listed["items"])
    summary = (await http.get("/api/clinic-app/accounts/summary", headers=owner)).json()
    domestic = next(c for c in summary["categories"] if c["category"] == "Domestic")
    assert domestic["amount"] >= 15000 and domestic["entries"] >= 1
    assert summary["net"] == summary["collected"] - summary["expenses"]
    # the reception web app's admin is not a finance role here, but an administrator is
    assert (await http.get("/api/expenses", headers=await staff_headers(http, ADMIN))).status_code == 200


async def test_invoices_receipts_and_statement(http):
    owner, _, accountant = await logins(http)
    month_start = date.today().replace(day=1).isoformat()
    today = date.today().isoformat()
    year_ago = (date.today() - timedelta(days=365)).isoformat()
    assert (await http.get(f"/api/clinic-app/accounts/invoices?date_from=2020-01-01&date_to={today}", headers=accountant)).status_code == 400
    invoices = (await http.get(f"/api/clinic-app/accounts/invoices?date_from={year_ago}&date_to={today}", headers=accountant)).json()["items"]
    assert invoices
    one = (await http.get(f"/api/clinic-app/accounts/invoices/{invoices[0]['id']}", headers=accountant)).json()
    assert one["number"] == invoices[0]["number"] and "receipts" in one and one["clinic"]["name"]
    receipts = (await http.get(f"/api/clinic-app/accounts/receipts?date_from={year_ago}&date_to={today}", headers=accountant)).json()["items"]
    assert receipts
    st = (await http.get(f"/api/clinic-app/accounts/statement?date_from={month_start}&date_to={today}", headers=owner)).json()
    assert round(st["received"] - st["paid_out"], 2) == st["net"]
    if st["rows"]:
        assert st["rows"][-1]["balance"] == st["net"]
    assert (await http.get(f"/api/clinic-app/accounts/statement?date_from={today}&date_to=2020-01-01", headers=owner)).status_code == 400


async def test_dentor_accounts_and_consultant_earnings(http):
    owner, doctor, consultant, patient = await consult_setup(http)
    d, times = await free(http, owner, consultant["id"], 8)
    req = (await http.post("/api/clinic-app/consult/requests", headers=owner, json={
        "patient_id": patient["id"], "choice": "own", "consultant_id": consultant["id"], "date": d, "time": times[0], **CASE})).json()
    await http.post(f"/api/consultant/requests/{req['id']}/accept", headers=doctor, json={})
    pending = (await http.get(f"/api/clinic-app/accounts/dentor?status=pending&date_from={d}&date_to={d}", headers=owner)).json()
    assert any(x["id"] == req["id"] and x["fee"] == 1200 for x in pending["items"])
    visits = (await http.get("/api/consultant/earnings/visits?status=pending", headers=doctor)).json()
    assert any(x["id"] == req["id"] and x["group"] == "pending" for x in visits["items"]) and visits["totals"]["pending"] >= 1200
    await http.post(f"/api/clinic-app/consult/requests/{req['id']}/cancel", headers=owner, json={"reason": "test clean-up"})
    cancelled = (await http.get("/api/consultant/earnings/visits?status=cancelled", headers=doctor)).json()["items"]
    assert any(x["id"] == req["id"] for x in cancelled)
