import express, {Request, Response, NextFunction} from 'express';
import { UserRouter } from './Entities/User/user.routes.js';

const app = express();
app.use(express.json());

app.use('/api/users', UserRouter)

app.use((_, res) => {
    return res.status(404).send({ error: 'Resource not found' });
});


app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});