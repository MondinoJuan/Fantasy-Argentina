import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { Repository } from '../../shared/repository.js';
import { Shielding } from './shielding.entity.js';

type ShieldingRow = RowDataPacket & {
  id_shielding: number;
  id_clause: any; id_participant: any; invested_amount: any; clause_increase: any; shielding_date: any; 
};

export class ShieldingRepository implements Repository<Shielding> {
  private readonly tableName = 'shielding';

  private mapRowToEntity(row: ShieldingRow): Shielding {
    return {
      id: String(row.id_shielding),
      playerClauseId: row.id_clause,
      participantId: row.id_participant,
      investedAmount: row.invested_amount,
      clauseIncrease: row.clause_increase,
      shieldingDate: row.shielding_date ? new Date(row.shielding_date) : (null as unknown as Date),
    } as Shielding;
  }

  public async findAll(): Promise<Shielding[] | undefined> {
    const [rows] = await pool.query<ShieldingRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<Shielding | undefined> {
    const [rows] = await pool.query<ShieldingRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_shielding = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: Shielding): Promise<Shielding | undefined> {
    const rowData = {
      id_clause: item.playerClauseId,
      id_participant: item.participantId,
      invested_amount: item.investedAmount,
      clause_increase: item.clauseIncrease,
      shielding_date: item.shieldingDate,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: Shielding): Promise<Shielding | undefined> {
    const rowData = {
      id_clause: item.playerClauseId,
      id_participant: item.participantId,
      invested_amount: item.investedAmount,
      clause_increase: item.clauseIncrease,
      shielding_date: item.shieldingDate,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_shielding = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<Shielding | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_shielding = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
