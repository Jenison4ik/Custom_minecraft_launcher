import express from 'express';
import os from 'os';
import path from 'path';
import dotenv from 'dotenv';
const app = express();
dotenv.config({ path: path.join(os.homedir(), '.env') });
const port = process.env.PORT || 8080;
app.use((req, res, next) => {
    process.stdout.write(`Used rote ${req.url.toString()}\n`);
    next();
});
app.get('/test', (req, res, next) => {
    res.json({ otvet: 'hello world!\n' });
    next();
});
app.listen(port, () => {
    process.stdout.write(`Server started on ${port}\n`);
});
//# sourceMappingURL=index.js.map