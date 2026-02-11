import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { toNullableMysqlDateTime, toMysqlDateTime } from '../../shared/db/datetime.js';
import { Repository } from '../../shared/repository.js';
import { Transaction } from './transaction.entity.js';

type TransactionRow = RowDataPacket & {
  id_transaction: number;
  id_origin_participant: any; id_target_participant: any; id_tournament: any; type: any; amount: any; ref_table: any; ref_id: any; creation_date: any; publish_date: any; effective_date: any; 
};

export class TransactionRepository implements Repository<Transaction> {
  private readonly tableName = 'transaction';

  private mapRowToEntity(row: TransactionRow): Transaction {
    return {
      id: String(row.id_transaction),
      originParticipantId: row.id_origin_participant,
      destinationParticipantId: row.id_target_participant,
      tournamentId: row.id_tournament,
      type: row.type,
      amount: row.amount,
      referenceTable: row.ref_table,
      referenceId: row.ref_id,
      creationDate: row.creation_date ? new Date(row.creation_date) : (null as unknown as Date),
      publicationDate: row.publish_date ? new Date(row.publish_date) : (null as unknown as Date),
      effectiveDate: row.effective_date ? new Date(row.effective_date) : (null as unknown as Date),
    } as Transaction;
  }

  public async findAll(): Promise<Transaction[] | undefined> {
    const [rows] = await pool.query<TransactionRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<Transaction | undefined> {
    const [rows] = await pool.query<TransactionRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_transaction = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: Transaction): Promise<Transaction | undefined> {
    const rowData = {
      id_origin_participant: item.originParticipantId,
      id_target_participant: item.destinationParticipantId,
      id_tournament: item.tournamentId,
      type: item.type,
      amount: item.amount,
      ref_table: item.referenceTable,
      ref_id: item.referenceId,
      creation_date: toMysqlDateTime(new Date()),
      publish_date: toNullableMysqlDateTime(item.publicationDate),
      effective_date: toNullableMysqlDateTime(item.effectiveDate),
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: Transaction): Promise<Transaction | undefined> {
    const rowData = {
      id_origin_participant: item.originParticipantId,
      id_target_participant: item.destinationParticipantId,
      id_tournament: item.tournamentId,
      type: item.type,
      amount: item.amount,
      ref_table: item.referenceTable,
      ref_id: item.referenceId,
      publish_date: toNullableMysqlDateTime(item.publicationDate),
      effective_date: toNullableMysqlDateTime(item.effectiveDate),
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_transaction = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<Transaction | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_transaction = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
