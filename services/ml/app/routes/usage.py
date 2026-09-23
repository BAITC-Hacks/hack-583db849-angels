"""Gateway usage aggregation backed by the privacy-safe cost log."""

from decimal import Decimal, ROUND_CEILING

from ..config import GatewayMode
from ..gateway.usage import FileUsageStore
from ..schemas.contracts import Usage


REPORTING_PRECISION = Decimal("0.000001")


async def usage_summary(
    store: FileUsageStore,
    gateway_mode: GatewayMode,
    cap_usd: Decimal,
) -> Usage:
    records = await store.records()
    spent = sum((record.actual_usd for record in records), Decimal(0))
    rounded_spent = spent.quantize(REPORTING_PRECISION, rounding=ROUND_CEILING)
    return Usage(
        gatewayMode=gateway_mode,
        liveCalls=sum(record.source == "provider" for record in records),
        replayedCalls=sum(record.source != "provider" for record in records),
        spentUsd=float(rounded_spent),
        capUsd=float(cap_usd),
    )
