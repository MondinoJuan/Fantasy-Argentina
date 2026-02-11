import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { Repository } from '../../shared/repository.js';
import { Participant } from './participant.entity.js';

type ParticipantRow = RowDataPacket & {
  id_participant: number;
  id_user: any; id_tournament: any; bank_budget: any; reserved_money: any; available_money: any; total_points: any; join_date: any; 
};

export class ParticipantRepository implements Repository<Participant> {
  private readonly tableName = 'Participant';

  private mapRowToEntity(row: ParticipantRow): Participant {
    return {
      id: String(row.id_participant),
      userId: row.id_user,
      tournamentId: row.id_tournament,
      bankBudget: row.bank_budget,
      reservedMoney: row.reserved_money,
      availableMoney: row.available_money,
      totalScore: row.total_points,
      joinDate: row.join_date ? new Date(row.join_date) : (null as unknown as Date),
    } as Participant;
  }

  public async findAll(): Promise<Participant[] | undefined> {
    const [rows] = await pool.query<ParticipantRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<Participant | undefined> {
    const [rows] = await pool.query<ParticipantRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_participant = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: Participant): Promise<Participant | undefined> {
    const rowData = {
      id_user: item.userId,
      id_tournament: item.tournamentId,
      bank_budget: item.bankBudget,
      reserved_money: item.reservedMoney,
      total_points: item.totalScore,
      join_date: item.joinDate,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: Participant): Promise<Participant | undefined> {
    const rowData = {
      id_user: item.userId,
      id_tournament: item.tournamentId,
      bank_budget: item.bankBudget,
      reserved_money: item.reservedMoney,
      total_points: item.totalScore,
      join_date: item.joinDate,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_participant = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<Participant | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_participant = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
