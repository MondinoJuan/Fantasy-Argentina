import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { Repository } from '../../shared/repository.js';
import { RealTeam } from './realTeam.entity.js';

type RealTeamRow = RowDataPacket & {
  id_real_team: number;
  name: any; id_league: any; external_api_id: any; 
};

export class RealTeamRepository implements Repository<RealTeam> {
  private readonly tableName = 'realteam';

  private mapRowToEntity(row: RealTeamRow): RealTeam {
    return {
      id: String(row.id_real_team),
      name: row.name,
      leagueId: row.id_league,
      externalApiId: row.external_api_id,
    } as RealTeam;
  }

  public async findAll(): Promise<RealTeam[] | undefined> {
    const [rows] = await pool.query<RealTeamRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<RealTeam | undefined> {
    const [rows] = await pool.query<RealTeamRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_real_team = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: RealTeam): Promise<RealTeam | undefined> {
    const rowData = {
      name: item.name,
      id_league: item.leagueId,
      external_api_id: item.externalApiId,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: RealTeam): Promise<RealTeam | undefined> {
    const rowData = {
      name: item.name,
      id_league: item.leagueId,
      external_api_id: item.externalApiId,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_real_team = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<RealTeam | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_real_team = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
