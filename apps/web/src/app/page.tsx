import Link from "next/link";
import type { ReactNode } from "react";

import { ContractLink } from "@/components/ContractLink";
import {
  ConnectWalletCard,
  PositionCount,
} from "@/components/OverviewInteractive";
import { PositionBackup } from "@/components/PositionRegistry";
import { t } from "@/lib/i18n";
import { BATCH_PAYOUT_CONTRACT, shortAddress } from "@/lib/network";

export default function OverviewPage() {
  return (
    <div className="stack">
      <div>
        <h1>{t("overview.title")}</h1>
        <p className="muted page-intro">{t("overview.intro")}</p>
      </div>

      <ConnectWalletCard />

      <div className="grid">
        <Tile
          href="/payroll"
          title={t("overview.tile.payroll.title")}
          body={t("overview.tile.payroll.body")}
        />
        <Tile
          href="/streams"
          title={t("overview.tile.streams.title")}
          count={<PositionCount kind="stream" />}
          body={t("overview.tile.streams.body")}
        />
        <Tile
          href="/vesting"
          title={t("overview.tile.vesting.title")}
          count={<PositionCount kind="vesting" />}
          body={t("overview.tile.vesting.body")}
        />
        <Tile
          href="/escrow"
          title={t("overview.tile.escrow.title")}
          count={<PositionCount kind="escrow" />}
          body={t("overview.tile.escrow.body")}
        />
      </div>

      <div className="card stack stack--tight">
        <h2>{t("overview.positions.title")}</h2>
        <p className="small muted m-0">{t("overview.positions.p1")}</p>
        <p className="small muted m-0">{t("overview.positions.p2")}</p>
        <p className="small muted m-0">
          <code className="addr">batch_payout</code> {t("overview.positions.batchPrefix")}{" "}
          <ContractLink id={BATCH_PAYOUT_CONTRACT} className="addr">
            {shortAddress(BATCH_PAYOUT_CONTRACT, 6)}
          </ContractLink>
        </p>
      </div>

      <PositionBackup />

      <div className="notice notice--warn">
        <div className="notice__title">{t("overview.notBuilt.title")}</div>
        <div className="notice__detail">{t("overview.notBuilt.detail")}</div>
      </div>
    </div>
  );
}

function Tile({
  href,
  title,
  count,
  body,
}: {
  href: string;
  title: string;
  count?: ReactNode;
  body: string;
}) {
  return (
    <Link href={href} className="card card--link">
      <div className="spread">
        <h2>{title}</h2>
        {count}
      </div>
      <p className="small muted mb-0">
        {body}
      </p>
    </Link>
  );
}
