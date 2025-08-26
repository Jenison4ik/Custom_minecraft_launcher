import express from 'express';
import os from 'os';
import path from 'path';


const app = express();

app.use((req,res,next)=>{
    process.stdout.write(`Used rote ${req.url.toString()}\n`);
    next()
})


app.get('/test', (req,res,next)=>{
    res.json({otvet: 'hello world!\n'});
    next();
})

app.listen(8080,()=>{
    process.stdout.write('Server started on 8080\n')
})