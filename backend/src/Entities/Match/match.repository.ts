import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { Repository } from '../../shared/repository.js';
import { Match } from './match.entity.js';

type MatchRow = RowDataPacket & {
  id_match: number;
  id_matchday: any; external_api_id: any; home_team: any; away_team: any; start_datetime: any; status: any; 
};

export class MatchRepository implements Repository<Match> {
  private readonly tableName = '`match`';

  private mapRowToEntity(row: MatchRow): Match {
    return {
      id: String(row.id_match),
      matchdayId: row.id_matchday,
      externalApiId: row.external_api_id,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      startDateTime: row.start_datetime ? new Date(row.start_datetime) : (null as unknown as Date),
      status: row.status,
    } as Match;
  }

  public async findAll(): Promise<Match[] | undefined> {
    const [rows] = await pool.query<MatchRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<Match | undefined> {
    const [rows] = await pool.query<MatchRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_match = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: Match): Promise<Match | undefined> {
    const rowData = {
      id_matchday: item.matchdayId,
      external_api_id: item.externalApiId,
      home_team: item.homeTeam,
      away_team: item.awayTeam,
      start_datetime: item.startDateTime,
      status: item.status,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: Match): Promise<Match | undefined> {
    const rowData = {
      id_matchday: item.matchdayId,
      external_api_id: item.externalApiId,
      home_team: item.homeTeam,
      away_team: item.awayTeam,
      start_datetime: item.startDateTime,
      status: item.status,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_match = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<Match | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_match = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
