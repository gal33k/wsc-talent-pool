"""MOCK: HubSpot CRM write-back.

Real counterpart:  HubSpot CRM
Real endpoints:
  PATCH /crm/v3/objects/contacts/{contact_id}   write talent-pool properties
  GET   /crm/v3/objects/contacts/{contact_id}   read contact (not used yet)
"""
from . import call_log


def write_talent_pool_properties(contact_id: str, properties: dict) -> None:
    """The write-back the pipeline would perform after Decision A. Logs the
    exact PATCH body so the integrations screen shows the surface."""
    call_log.log(
        system="hubspot",
        method="PATCH",
        endpoint=f"/crm/v3/objects/contacts/{contact_id}",
        result="204 no content",
        payload={"properties": properties},
    )
