// One central box for player reports, so they can be reviewed in one place (master plan, safety:
// "Report, block and mute on every player and message, with a human review queue").
import { DurableObject } from 'cloudflare:workers';

export type Report = {
  at: number; // time of the report, ms
  area: string;
  reporterName: string;
  reportedId: string;
  reportedName: string;
  reason: string;
  recentChat: string[]; // the reported player's last few messages, for context
};

const KEEP = 2000; // reports kept; the oldest are dropped beyond this

export class ReportBox extends DurableObject {
  async add(report: Report): Promise<void> {
    const key = `r:${String(report.at).padStart(15, '0')}:${crypto.randomUUID().slice(0, 6)}`;
    await this.ctx.storage.put(key, report);
    const all = await this.ctx.storage.list({ prefix: 'r:', limit: KEEP + 50 });
    if (all.size > KEEP) {
      const oldest = [...all.keys()].slice(0, all.size - KEEP);
      await this.ctx.storage.delete(oldest);
    }
  }

  async latest(limit = 200): Promise<Report[]> {
    const rows = await this.ctx.storage.list<Report>({ prefix: 'r:', reverse: true, limit });
    return [...rows.values()];
  }
}
