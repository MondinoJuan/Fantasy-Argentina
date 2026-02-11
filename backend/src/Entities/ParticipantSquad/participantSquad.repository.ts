import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { toNullableMysqlDateTime, toMysqlDateTime } from '../../shared/db/datetime.js';
import { Repository } from '../../shared/repository.js';
import { ParticipantSquad } from './participantSquad.entity.js';

type ParticipantSquadRow = RowDataPacket & {
  id_squad: number;
  id_participant: any; id_real_player: any; acquisition_date: any; release_date: any; buy_price: any; acquisition_type: any; 
};

export class ParticipantSquadRepository implements Repository<ParticipantSquad> {
  private readonly tableName = 'participantsquad';

  private mapRowToEntity(row: ParticipantSquadRow): ParticipantSquad {
    return {
      id: String(row.id_squad),
      participantId: row.id_participant,
      realPlayerId: row.id_real_player,
      acquisitionDate: row.acquisition_date ? new Date(row.acquisition_date) : (null as unknown as Date),
      releaseDate: row.release_date ? new Date(row.release_date) : (null as unknown as Date),
      purchasePrice: row.buy_price,
      acquisitionType: row.acquisition_type,
    } as ParticipantSquad;
  }

  public async findAll(): Promise<ParticipantSquad[] | undefined> {
    const [rows] = await pool.query<ParticipantSquadRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<ParticipantSquad | undefined> {
    const [rows] = await pool.query<ParticipantSquadRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_squad = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: ParticipantSquad): Promise<ParticipantSquad | undefined> {
    const rowData = {
      id_participant: item.participantId,
      id_real_player: item.realPlayerId,
      acquisition_date: toMysqlDateTime(new Date()),
      release_date: toNullableMysqlDateTime(item.releaseDate),
      buy_price: item.purchasePrice,
      acquisition_type: item.acquisitionType,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: ParticipantSquad): Promise<ParticipantSquad | undefined> {
    const rowData = {
      id_participant: item.participantId,
      id_real_player: item.realPlayerId,
      release_date: toNullableMysqlDateTime(item.releaseDate),
      buy_price: item.purchasePrice,
      acquisition_type: item.acquisitionType,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_squad = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<ParticipantSquad | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_squad = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
