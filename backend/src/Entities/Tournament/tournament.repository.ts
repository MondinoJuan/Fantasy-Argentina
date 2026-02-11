import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { Repository } from '../../shared/repository.js';
import { Tournament } from './tournament.entity.js';

type TournamentRow = RowDataPacket & {
  id_tournament: number;
  name: any; id_league: any; creation_date: any; initial_budget: any; squad_size: any; status: any; clause_enable_date: any; 
};

export class TournamentRepository implements Repository<Tournament> {
  private readonly tableName = 'Tournament';

  private mapRowToEntity(row: TournamentRow): Tournament {
    return {
      id: String(row.id_tournament),
      name: row.name,
      leagueId: row.id_league,
      creationDate: row.creation_date ? new Date(row.creation_date) : (null as unknown as Date),
      initialBudget: row.initial_budget,
      squadSize: row.squad_size,
      status: row.status,
      clauseEnableDate: row.clause_enable_date ? new Date(row.clause_enable_date) : (null as unknown as Date),
    } as Tournament;
  }

  public async findAll(): Promise<Tournament[] | undefined> {
    const [rows] = await pool.query<TournamentRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<Tournament | undefined> {
    const [rows] = await pool.query<TournamentRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_tournament = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: Tournament): Promise<Tournament | undefined> {
    const rowData = {
      name: item.name,
      id_league: item.leagueId,
      creation_date: item.creationDate,
      initial_budget: item.initialBudget,
      squad_size: item.squadSize,
      status: item.status,
      clause_enable_date: item.clauseEnableDate,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: Tournament): Promise<Tournament | undefined> {
    const rowData = {
      name: item.name,
      id_league: item.leagueId,
      creation_date: item.creationDate,
      initial_budget: item.initialBudget,
      squad_size: item.squadSize,
      status: item.status,
      clause_enable_date: item.clauseEnableDate,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_tournament = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<Tournament | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_tournament = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
