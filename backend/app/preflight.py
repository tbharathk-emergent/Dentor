"""Read-only compatibility report for an upgrade to this backend.

    python -m app.preflight            # report for the database in MONGO_URL / DB_NAME
    python -m app.preflight --json     # the same, as JSON

It reads the clinics, their logins and their settings, and says what the access rules that
came with the mobile apps will change for each clinic, so problems can be fixed before the
new backend is deployed. It writes nothing. Exit code: 0 when nothing has to be fixed first,
1 when something does, 2 when the database cannot be read.

The rules it checks against (see docs/SCOPE_CHANGE.md):
- only a Clinic Owner or an Administrator may change clinic settings and manage logins;
- a login with the role "Consultant" can use the Consultant app only, and only when it is
  linked to a consultant profile;
- the Owner app needs a "Clinic Owner" login;
- patients book in the app only where "Patient app booking" is on;
- patient sign-up needs an SMS gateway in production.
"""
import argparse
import asyncio
import json
import sys

from .auth import SUPER_ADMIN_ROLE, verify_password
from .config import (
    CONSULTANT_DEFAULT_PASSWORD, CONSULTANT_EMAIL, DB_NAME, DEMO_PATIENT_MOBILE, DEMO_PATIENT_PASSWORD, ENV, IS_PROD,
    NOTIFICATION_RETENTION_DAYS, OWNER_DEFAULT_PASSWORD, OWNER_EMAIL, SEED_DEMO, SMS_PROVIDER,
)
from .notify import push_configured
from . import config as _config
from .otp import is_test_mobile, masked_mobile, sms_configured
from .roles import CLINIC_ADMIN_ROLES, CLINIC_OWNER, CONSULTANT, STAFF_ROLE_OPTIONS

# Demo logins whose passwords are printed in the README. Harmless on a developer's machine,
# an open door on a production server.
_DEMO_STAFF = {
    "admin@dentor.in": "Dentor@2026",
    OWNER_EMAIL: OWNER_DEFAULT_PASSWORD,
    CONSULTANT_EMAIL: CONSULTANT_DEFAULT_PASSWORD,
}


async def _clinic_report(db, clinic: dict) -> dict:
    clinic_id = str(clinic["_id"])
    suspended = clinic.get("status") == "Suspended"
    logins = await db.users.find({"clinic_id": clinic_id}, {"password_hash": 0}).to_list(None)
    active = [u for u in logins if u.get("status") != "Inactive"]
    roles: dict[str, int] = {}
    for user in active:
        roles[user.get("role") or "(none)"] = roles.get(user.get("role") or "(none)", 0) + 1
    admins = [u for u in active if u.get("role") in CLINIC_ADMIN_ROLES]
    owners = [u for u in active if u.get("role") == CLINIC_OWNER]
    consultants = [u for u in active if u.get("role") == CONSULTANT]
    unlinked = [u["email"] for u in consultants if not u.get("consultant_id")]
    settings_doc = await db.app_settings.find_one({"clinic_id": clinic_id, "key": "settings"})
    settings = (settings_doc or {}).get("values", {})

    must_fix, to_know = [], []
    if not admins and not suspended:
        must_fix.append(
            "No active Clinic Owner or Administrator login. After the upgrade nobody in this clinic could change "
            "settings or manage logins. Give one login the role Administrator or Clinic Owner first."
        )
    if unlinked:
        must_fix.append(
            f"{len(unlinked)} Consultant login(s) not linked to a consultant profile ({', '.join(unlinked)}). They could "
            "sign in nowhere after the upgrade: link each to its profile, or give it a staff role."
        )
    if consultants:
        to_know.append(
            f"{len(consultants)} login(s) with the role Consultant will be refused by the reception web app and must "
            "use the Consultant app."
        )
    if admins and not owners:
        to_know.append("No Clinic Owner login: the Owner app cannot be used until the Super Admin adds one.")
    non_admin = sum(n for role, n in roles.items() if role not in CLINIC_ADMIN_ROLES and role != CONSULTANT)
    if non_admin:
        to_know.append(f"{non_admin} staff login(s) that are not Owner or Administrator will no longer be able to change settings.")
    unknown = sorted(role for role in roles if role not in STAFF_ROLE_OPTIONS and role != "Doctor")
    if unknown:
        to_know.append(f"Roles outside the standard list ({', '.join(unknown)}) are treated as ordinary staff.")
    if not settings.get("onlineBooking", False):
        to_know.append('"Patient app booking" is off: patients cannot register with this clinic or book in the app until it is switched on in Settings.')
    return {
        "name": clinic.get("name", ""), "code": clinic.get("code", ""), "status": clinic.get("status", "Active"),
        "active_logins": len(active), "roles": roles,
        "owners_or_administrators": len(admins), "owners": len(owners),
        "consultant_logins": len(consultants), "consultant_logins_unlinked": unlinked,
        "patient_app_booking": bool(settings.get("onlineBooking", False)),
        "must_fix": must_fix, "to_know": to_know,
    }


async def build_report(db) -> dict:
    """Everything the report says, as data. Reads only."""
    clinics = [await _clinic_report(db, c) for c in await db.clinics.find({}).sort("code", 1).to_list(None)]

    must_fix, to_know = [], []
    demo = []
    for email, password in _DEMO_STAFF.items():
        user = await db.users.find_one({"email": email})
        if user and user.get("status") != "Inactive" and verify_password(password, user.get("password_hash", "")):
            demo.append(email)
    account = await db.patient_accounts.find_one({"mobile": DEMO_PATIENT_MOBILE})
    if account and verify_password(DEMO_PATIENT_PASSWORD, account.get("password_hash", "")):
        demo.append(f"patient {DEMO_PATIENT_MOBILE}")
    if demo:
        message = f"Demo logins still have the passwords printed in the README: {', '.join(demo)}."
        (must_fix if IS_PROD else to_know).append(message + (" Change them or deactivate the logins." if IS_PROD else " Fine for development."))
    if IS_PROD and SEED_DEMO:
        must_fix.append("SEED_DEMO is on in production: demo logins with known passwords are created at start-up. Set SEED_DEMO=0.")
    if not sms_configured():
        to_know.append("No SMS gateway (SMS_PROVIDER): patient sign-up, code login and reset by code are refused; password login works.")
    elif SMS_PROVIDER == "console":
        to_know.append("SMS is in test mode: codes are shown in the app and the server log, not sent.")
    if is_test_mobile(next(iter(_config.OTP_TEST_MOBILES), "")):
        to_know.append(f"A fixed test verification code is ON for {', '.join(masked_mobile(m) for m in _config.OTP_TEST_MOBILES)} "
                       "(OTP_TEST_MOBILES / OTP_TEST_CODE). Remove both settings and restart the API when testing is finished.")
    if _config.PATIENT_TEST_ACCOUNTS:
        to_know.append(f"{len(_config.PATIENT_TEST_ACCOUNTS)} test patient login(s) are configured (PATIENT_TEST_ACCOUNTS). "
                       "Remove the setting and restart the API when testing is finished: their accounts are then disabled.")
    if not push_configured():
        to_know.append("No push service (PUSH_PROVIDER): notifications appear inside the apps only.")
    to_know.append(
        f"Notifications are deleted {NOTIFICATION_RETENTION_DAYS} days after they are created."
        if NOTIFICATION_RETENTION_DAYS else "Notifications are kept for ever (NOTIFICATION_RETENTION_DAYS=0)."
    )
    super_admins = await db.users.count_documents({"role": SUPER_ADMIN_ROLE, "status": {"$ne": "Inactive"}})
    if not super_admins:
        must_fix.append("No active Super Admin login.")

    blocked = bool(must_fix) or any(c["must_fix"] for c in clinics)
    return {
        "environment": ENV, "database": DB_NAME, "clinics": clinics,
        "platform": {"must_fix": must_fix, "to_know": to_know, "sms": sms_configured(), "push": push_configured(),
                     "patient_app_accounts": await db.patient_accounts.count_documents({})},
        "ready": not blocked,
    }


def render(report: dict) -> str:
    lines = [
        f"Dentor upgrade check · environment: {report['environment']} · database: {report['database']}",
        "(read-only: nothing was changed)", "",
        "PLATFORM",
    ]
    for item in report["platform"]["must_fix"]:
        lines.append(f"  FIX FIRST  {item}")
    for item in report["platform"]["to_know"]:
        lines.append(f"  note       {item}")
    lines.append("")
    lines.append(f"CLINICS ({len(report['clinics'])})")
    for clinic in report["clinics"]:
        roles = ", ".join(f"{n} {role}" for role, n in sorted(clinic["roles"].items())) or "no active logins"
        lines.append(f"  {clinic['code']}  {clinic['name']}  [{clinic['status']}]  logins: {roles}")
        for item in clinic["must_fix"]:
            lines.append(f"      FIX FIRST  {item}")
        for item in clinic["to_know"]:
            lines.append(f"      note       {item}")
    lines.append("")
    lines.append(
        "RESULT: nothing has to be fixed before the upgrade." if report["ready"]
        else "RESULT: fix the items marked FIX FIRST before deploying the new backend."
    )
    return "\n".join(lines)


async def _run(as_json: bool) -> int:
    from .db import db  # imported here so --help works without a database

    try:
        report = await build_report(db)
    except Exception as exc:  # unreachable server, wrong credentials
        print(f"Could not read the database: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2) if as_json else render(report))
    return 0 if report["ready"] else 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Read-only check of what this backend's access rules change for existing clinics.")
    parser.add_argument("--json", action="store_true", help="print the report as JSON")
    args = parser.parse_args()
    sys.exit(asyncio.run(_run(args.json)))


if __name__ == "__main__":
    main()
