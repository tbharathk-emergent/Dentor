# Account deletion, Privacy Policy and Terms (store review)

What Google Play and the App Store look for, and where Dentor provides it.

## Delete my account (all three apps)

| App | Where | API |
| --- | --- | --- |
| Dentor (patients) | Profile › Delete account | `POST /api/patient/account/delete` `{password}` |
| Dentor Clinic Owner | More › Settings › Delete Account | `POST /api/auth/account/delete` `{password}` |
| Dentor Consultant | Profile › Settings › Delete Account | `POST /api/auth/account/delete` `{password}` |

It is a **soft delete** (`backend/app/account_deletion.py`):

- The login stops working at once: open sessions, fingerprint sign-ins and push tokens are ended.
- The login is hidden everywhere (staff lists, emails, lookups). Its mobile number and email are moved aside, so
  they can be used for a new account.
- Nothing else changes: the clinic keeps its patient records, appointments, prescriptions and bills.
- The login itself is kept. **Super Admin console › Deleted accounts › Restore** brings it back with the same
  password, unless a new account has taken the number or email meanwhile. There is no automatic wipe.
- The last active administrator of a clinic cannot delete their login (the clinic would have no one to manage
  it), and a Super Admin login cannot be deleted from the apps.

Permanent erasure on request (the Privacy Policy offers it): done by Dentor support on the server; there is no
button for it yet.

## Public pages for the store listings

Generated from the same texts the apps show (`mobile/packages/shared/src/legal/content.ts`) into
`frontend/public/legal/`, and published with the reception web app:

| Page | Address | Use in the store listing |
| --- | --- | --- |
| Privacy Policy, patients | `https://dentor.localappstore.in/legal/privacy-patient.html` | Dentor (patient app): Privacy policy URL |
| Terms of Use, patients | `https://dentor.localappstore.in/legal/terms-patient.html` | (optional) |
| Privacy Policy, clinics and consultants | `https://dentor.localappstore.in/legal/privacy-staff.html` | Clinic Owner and Consultant apps: Privacy policy URL |
| Terms, clinics and consultants | `https://dentor.localappstore.in/legal/terms-staff.html` | (optional) |
| Delete your account | `https://dentor.localappstore.in/legal/delete-account.html` | Play Console › Data safety › "Delete account URL" (all three apps) |

After changing the texts: `cd mobile && npm run legal` (rewrites the pages; `npm test` fails if you forget),
then deploy the reception web app as usual.

## Before publishing

1. A lawyer reviews the drafts in `content.ts`.
2. Fill in `LEGAL_DETAILS` there: contact email, postal address, Grievance Officer name and email (blanks show
   as "[… to be added]" in the apps and pages).
3. Set `DRAFT_NOTICE` to `''`: the "Draft for review" banner disappears from the apps and the pages.
4. `npm run legal`, rebuild the apps and the web app, deploy.
5. In Play Console › App content: Privacy policy (URL above), Data safety (answers must match the policy:
   data collected, shared with service providers, encrypted in transit, deletion available + the URL above).
