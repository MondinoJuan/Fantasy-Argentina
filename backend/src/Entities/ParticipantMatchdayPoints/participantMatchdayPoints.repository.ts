import { Repository } from '../../shared/repository.js';
import { ParticipantMatchdayPoints } from './participantMatchdayPoints.entity.js';

const participantMatchdayPointss = [
    new ParticipantMatchdayPoints(
    "sample",
    "sample",
    0,
    0,
    0,
    new Date("2024-01-01T00:00:00.000Z"),
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class ParticipantMatchdayPointsRepository implements Repository<ParticipantMatchdayPoints> {

    public findAll(): ParticipantMatchdayPoints[] | undefined {
        return participantMatchdayPointss;
    }

    public findOne(item: { id: string; }): ParticipantMatchdayPoints | undefined {
        return participantMatchdayPointss.find(i => i.id === item.id);
    }

    public add(item: ParticipantMatchdayPoints): ParticipantMatchdayPoints | undefined {
        participantMatchdayPointss.push(item);
        return item;
    }

    public update(item: ParticipantMatchdayPoints): ParticipantMatchdayPoints | undefined {
        const index = participantMatchdayPointss.findIndex(i => i.id === item.id);
        if (index !== -1) {
            participantMatchdayPointss[index] = {...participantMatchdayPointss[index], ...item};
        }
        return participantMatchdayPointss[index];
    }

    public delete(item: { id: string; }): ParticipantMatchdayPoints | undefined {
        const index = participantMatchdayPointss.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = participantMatchdayPointss[index];
            participantMatchdayPointss.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
