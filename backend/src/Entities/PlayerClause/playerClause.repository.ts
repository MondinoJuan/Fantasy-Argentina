import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { Repository } from '../../shared/repository.js';
import { PlayerClause } from './playerClause.entity.js';

type PlayerClauseRow = RowDataPacket & {
  id_clause: number;
  id_tournament: any; id_real_player: any; id_owner_participant: any; base_clause: any; additional_clause_shielding: any; total_clause: any; update_date: any; 
};

export class PlayerClauseRepository implements Repository<PlayerClause> {
  private readonly tableName = 'playerclause';

  private mapRowToEntity(row: PlayerClauseRow): PlayerClause {
    return {
      id: String(row.id_clause),
      tournamentId: row.id_tournament,
      realPlayerId: row.id_real_player,
      ownerParticipantId: row.id_owner_participant,
      baseClause: row.base_clause,
      additionalShieldingClause: row.additional_clause_shielding,
      totalClause: row.total_clause,
      updateDate: row.update_date ? new Date(row.update_date) : (null as unknown as Date),
    } as PlayerClause;
  }

  public async findAll(): Promise<PlayerClause[] | undefined> {
    const [rows] = await pool.query<PlayerClauseRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<PlayerClause | undefined> {
    const [rows] = await pool.query<PlayerClauseRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_clause = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: PlayerClause): Promise<PlayerClause | undefined> {
    const rowData = {
      id_tournament: item.tournamentId,
      id_real_player: item.realPlayerId,
      id_owner_participant: item.ownerParticipantId,
      base_clause: item.baseClause,
      additional_clause_shielding: item.additionalShieldingClause,
      total_clause: item.totalClause,
      update_date: item.updateDate,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: PlayerClause): Promise<PlayerClause | undefined> {
    const rowData = {
      id_tournament: item.tournamentId,
      id_real_player: item.realPlayerId,
      id_owner_participant: item.ownerParticipantId,
      base_clause: item.baseClause,
      additional_clause_shielding: item.additionalShieldingClause,
      total_clause: item.totalClause,
      update_date: item.updateDate,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_clause = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<PlayerClause | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_clause = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
