"""MOCK: Slack / email notifier.

Real counterpart:  Slack (or SendGrid for email fallback)
Real endpoint:     POST /chat.postMessage

The reverse-referral action from docs/06. request_intro logs the DM that would
be sent to the WSC employee and returns a fake message id.
"""
from . import call_log


def request_intro(employee_name: str, candidate_name: str, job_title: str) -> str:
    payload = {
        "channel": f"@{employee_name.lower().replace(' ', '.')}",
        "text": (
            f"Hi {employee_name.split()[0]} - we're hiring a {job_title}. "
            f"{candidate_name} looks like a strong match. Would you introduce us?"
        ),
    }
    call_log.log(
        system="notifier",
        method="POST",
        endpoint="/chat.postMessage",
        result="queued (mock)",
        payload=payload,
    )
    return f"mock-msg-{abs(hash((employee_name, candidate_name))) % 10**8}"
