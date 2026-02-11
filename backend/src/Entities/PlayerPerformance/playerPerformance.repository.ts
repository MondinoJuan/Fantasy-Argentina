import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { Repository } from '../../shared/repository.js';
import { PlayerPerformance } from './playerPerformance.entity.js';

type PlayerPerformanceRow = RowDataPacket & {
  id_performance: number;
  id_real_player: any; id_matchday: any; points_obtained: any; played: any; update_date: any; 
};

export class PlayerPerformanceRepository implements Repository<PlayerPerformance> {
  private readonly tableName = 'PlayerPerformance';

  private mapRowToEntity(row: PlayerPerformanceRow): PlayerPerformance {
    return {
      id: String(row.id_performance),
      realPlayerId: row.id_real_player,
      matchdayId: row.id_matchday,
      pointsObtained: row.points_obtained,
      played: row.played,
      updateDate: row.update_date ? new Date(row.update_date) : (null as unknown as Date),
    } as PlayerPerformance;
  }

  public async findAll(): Promise<PlayerPerformance[] | undefined> {
    const [rows] = await pool.query<PlayerPerformanceRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<PlayerPerformance | undefined> {
    const [rows] = await pool.query<PlayerPerformanceRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_performance = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: PlayerPerformance): Promise<PlayerPerformance | undefined> {
    const rowData = {
      id_real_player: item.realPlayerId,
      id_matchday: item.matchdayId,
      points_obtained: item.pointsObtained,
      played: item.played,
      update_date: item.updateDate,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: PlayerPerformance): Promise<PlayerPerformance | undefined> {
    const rowData = {
      id_real_player: item.realPlayerId,
      id_matchday: item.matchdayId,
      points_obtained: item.pointsObtained,
      played: item.played,
      update_date: item.updateDate,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_performance = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<PlayerPerformance | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_performance = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
