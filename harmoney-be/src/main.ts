import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express = require('express');

const server = express();

async function createServer() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.enableCors();
  await app.init();

  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`=== SERVER RUNNING AT PORT ${port} ===`);
  }
}

createServer();

export default server;