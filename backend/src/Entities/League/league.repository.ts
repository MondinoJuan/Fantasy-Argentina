import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { Repository } from '../../shared/repository.js';
import { League } from './league.entity.js';

type LeagueRow = RowDataPacket & {
  id_league: number;
  name: any; country: any; external_api_id: any; 
};

export class LeagueRepository implements Repository<League> {
  private readonly tableName = 'league';

  private mapRowToEntity(row: LeagueRow): League {
    return {
      id: String(row.id_league),
      name: row.name,
      country: row.country,
      externalApiId: row.external_api_id,
    } as League;
  }

  public async findAll(): Promise<League[] | undefined> {
    const [rows] = await pool.query<LeagueRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<League | undefined> {
    const [rows] = await pool.query<LeagueRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_league = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: League): Promise<League | undefined> {
    const rowData = {
      name: item.name,
      country: item.country,
      external_api_id: item.externalApiId,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: League): Promise<League | undefined> {
    const rowData = {
      name: item.name,
      country: item.country,
      external_api_id: item.externalApiId,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_league = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<League | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_league = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
