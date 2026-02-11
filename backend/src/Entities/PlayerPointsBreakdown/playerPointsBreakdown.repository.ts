import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { Repository } from '../../shared/repository.js';
import { PlayerPointsBreakdown } from './playerPointsBreakdown.entity.js';

type PlayerPointsBreakdownRow = RowDataPacket & {
  id_breakdown: number;
  id_participant: any; id_matchday: any; id_real_player: any; contributed_pts: any; id_performance: any; 
};

export class PlayerPointsBreakdownRepository implements Repository<PlayerPointsBreakdown> {
  private readonly tableName = 'playerpointsbreakdown';

  private mapRowToEntity(row: PlayerPointsBreakdownRow): PlayerPointsBreakdown {
    return {
      id: String(row.id_breakdown),
      participantId: row.id_participant,
      matchdayId: row.id_matchday,
      realPlayerId: row.id_real_player,
      contributedPoints: row.contributed_pts,
      playerPerformanceId: row.id_performance,
    } as PlayerPointsBreakdown;
  }

  public async findAll(): Promise<PlayerPointsBreakdown[] | undefined> {
    const [rows] = await pool.query<PlayerPointsBreakdownRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<PlayerPointsBreakdown | undefined> {
    const [rows] = await pool.query<PlayerPointsBreakdownRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_breakdown = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: PlayerPointsBreakdown): Promise<PlayerPointsBreakdown | undefined> {
    const rowData = {
      id_participant: item.participantId,
      id_matchday: item.matchdayId,
      id_real_player: item.realPlayerId,
      contributed_pts: item.contributedPoints,
      id_performance: item.playerPerformanceId,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: PlayerPointsBreakdown): Promise<PlayerPointsBreakdown | undefined> {
    const rowData = {
      id_participant: item.participantId,
      id_matchday: item.matchdayId,
      id_real_player: item.realPlayerId,
      contributed_pts: item.contributedPoints,
      id_performance: item.playerPerformanceId,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_breakdown = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<PlayerPointsBreakdown | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_breakdown = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
