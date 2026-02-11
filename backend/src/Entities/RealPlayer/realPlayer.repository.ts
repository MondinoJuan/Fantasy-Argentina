import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { Repository } from '../../shared/repository.js';
import { RealPlayer } from './realPlayer.entity.js';

type RealPlayerRow = RowDataPacket & {
  id_real_player: number;
  external_api_id: any; name: any; position: any; id_real_team: any; market_value: any; active: any; last_update: any; 
};

export class RealPlayerRepository implements Repository<RealPlayer> {
  private readonly tableName = 'realplayer';

  private mapRowToEntity(row: RealPlayerRow): RealPlayer {
    return {
      id: String(row.id_real_player),
      externalApiId: row.external_api_id,
      name: row.name,
      position: row.position,
      realTeamId: row.id_real_team,
      marketValue: row.market_value,
      active: Boolean(row.active),
      lastUpdate: row.last_update ? new Date(row.last_update) : (null as unknown as Date),
    } as RealPlayer;
  }

  public async findAll(): Promise<RealPlayer[] | undefined> {
    const [rows] = await pool.query<RealPlayerRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<RealPlayer | undefined> {
    const [rows] = await pool.query<RealPlayerRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_real_player = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: RealPlayer): Promise<RealPlayer | undefined> {
    const rowData = {
      external_api_id: item.externalApiId,
      name: item.name,
      position: item.position,
      id_real_team: item.realTeamId,
      market_value: item.marketValue,
      active: item.active,
      last_update: item.lastUpdate,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: RealPlayer): Promise<RealPlayer | undefined> {
    const rowData = {
      external_api_id: item.externalApiId,
      name: item.name,
      position: item.position,
      id_real_team: item.realTeamId,
      market_value: item.marketValue,
      active: item.active,
      last_update: item.lastUpdate,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_real_player = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<RealPlayer | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_real_player = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
