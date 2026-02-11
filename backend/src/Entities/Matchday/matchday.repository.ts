import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { toMysqlDate } from '../../shared/db/datetime.js';
import { Repository } from '../../shared/repository.js';
import { Matchday } from './matchday.entity.js';

type MatchdayRow = RowDataPacket & {
  id_matchday: number;
  id_league: any; season: any; matchday_number: any; start_date: any; end_date: any; status: any; 
};

export class MatchdayRepository implements Repository<Matchday> {
  private readonly tableName = 'matchday';

  private mapRowToEntity(row: MatchdayRow): Matchday {
    return {
      id: String(row.id_matchday),
      leagueId: row.id_league,
      season: row.season,
      matchdayNumber: row.matchday_number,
      startDate: row.start_date ? new Date(row.start_date) : (null as unknown as Date),
      endDate: row.end_date ? new Date(row.end_date) : (null as unknown as Date),
      status: row.status,
    } as Matchday;
  }

  public async findAll(): Promise<Matchday[] | undefined> {
    const [rows] = await pool.query<MatchdayRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<Matchday | undefined> {
    const [rows] = await pool.query<MatchdayRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_matchday = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: Matchday): Promise<Matchday | undefined> {
    const rowData = {
      id_league: item.leagueId,
      season: item.season,
      matchday_number: item.matchdayNumber,
      start_date: toMysqlDate(item.startDate),
      end_date: toMysqlDate(item.endDate),
      status: item.status,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: Matchday): Promise<Matchday | undefined> {
    const rowData = {
      id_league: item.leagueId,
      season: item.season,
      matchday_number: item.matchdayNumber,
      start_date: toMysqlDate(item.startDate),
      end_date: toMysqlDate(item.endDate),
      status: item.status,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_matchday = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<Matchday | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_matchday = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
