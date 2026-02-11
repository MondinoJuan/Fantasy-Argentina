import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { toMysqlDateTime } from '../../shared/db/datetime.js';
import { Repository } from '../../shared/repository.js';
import { ParticipantMatchdayPoints } from './participantMatchdayPoints.entity.js';

type ParticipantMatchdayPointsRow = RowDataPacket & {
  id_participant_matchday_points: number;
  id_participant: any; id_matchday: any; matchday_points: any; calc_date: any; 
};

export class ParticipantMatchdayPointsRepository implements Repository<ParticipantMatchdayPoints> {
  private readonly tableName = 'participantmatchdaypoints';

  private mapRowToEntity(row: ParticipantMatchdayPointsRow): ParticipantMatchdayPoints {
    return {
      id: String(row.id_participant_matchday_points),
      participantId: row.id_participant,
      matchdayId: row.id_matchday,
      matchdayPoints: row.matchday_points,
      accumulatedPoints: null as unknown as number,
      position: null as unknown as number,
      calculationDate: row.calc_date ? new Date(row.calc_date) : (null as unknown as Date),
    } as ParticipantMatchdayPoints;
  }

  public async findAll(): Promise<ParticipantMatchdayPoints[] | undefined> {
    const [rows] = await pool.query<ParticipantMatchdayPointsRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<ParticipantMatchdayPoints | undefined> {
    const [rows] = await pool.query<ParticipantMatchdayPointsRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_participant_matchday_points = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: ParticipantMatchdayPoints): Promise<ParticipantMatchdayPoints | undefined> {
    const rowData = {
      id_participant: item.participantId,
      id_matchday: item.matchdayId,
      matchday_points: item.matchdayPoints,
      calc_date: toMysqlDateTime(item.calculationDate),
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: ParticipantMatchdayPoints): Promise<ParticipantMatchdayPoints | undefined> {
    const rowData = {
      id_participant: item.participantId,
      id_matchday: item.matchdayId,
      matchday_points: item.matchdayPoints,
      calc_date: toMysqlDateTime(item.calculationDate),
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_participant_matchday_points = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<ParticipantMatchdayPoints | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_participant_matchday_points = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
