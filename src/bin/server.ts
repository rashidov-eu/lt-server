#!./node_modules/.bin/tsx

import 'dotenv/config';

import { InvalidArgumentError, Option, program } from 'commander';
import { AddressInfo } from 'net';
import pkg from '../../package.json' with { type: "json" };
import { newLogger, setLogLevel } from '../lib/logger.js';
import createServer from '../server.js';

type CliOpts = {
  secure: boolean
  port: number
  address: string,
  domain: string,
  landing: string,
  maxSockets: number,
  range: string,
  secret: string,
  logLevel: string,
}

const runServer = (opts: CliOpts) => {
  
  const logger = newLogger('server:lt')

  setLogLevel(opts.logLevel);

  const server = createServer({
    max_tcp_sockets: opts.maxSockets,
    secure: opts.secure,
    domain: opts.domain,
    landing: opts.landing,
    secret: opts.secret,
  });

  server.listen(opts.port, opts.address, () => {
    const addr = server.address() as AddressInfo
    logger.info(`server listening on port: ${addr.port}`);
  });

  process.on('SIGINT', () => {
    // for nodemon to reload https://github.com/remy/nodemon#gracefully-reloading-down-your-script
    process.kill(process.pid, "SIGTERM");
  });

  process.on('uncaughtException', (err) => {
    logger.error(`uncaughtException: ${err.message}`);
    logger.debug(err.stack);
    process.exit(1)
  });

  process.on('unhandledRejection', (reason: string, promise: Promise<unknown>) => {
    logger.error(`unhandledRejection: ${reason}`);
    process.exit(1)
  });

}

const main = async () => {
  
  const intParser = (value: string) => {
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) {
      throw new InvalidArgumentError('Not a number.');
    }
    return parsedValue;
  }

  const rangeParser = (value: string) => {
    if (!value) return undefined
    const [rangeFrom, rangeTo] = value.split(':').map(r => parseInt(r, 10))
    if (isNaN(rangeFrom) || isNaN(rangeTo)) {
      throw new InvalidArgumentError('Range is not valid');
    }

    if (rangeFrom > rangeTo) {
      throw new Error('Bad range expression min > max: ' + value);
    }

    return value;
  }

  program
    .name('localtunnel-server')
    .description('localtunnel server')
    .version(pkg.version)
    
    .addOption(new Option('--log-level', 'set log level').default('info').env('LOG_LEVEL'))
    .addOption(new Option('--secure', 'use this flag to indicate proxy over https').default(false).env('SECURE'))
    
    .addOption(new Option('--port, -p <number>', 'listen on this port for outside requests').argParser(intParser).default(80).env('PORT'))
    .addOption(new Option('--address, -a <string>', 'IP address to bind to').default('0.0.0.0').env('ADDRESS'))
    
    .addOption(
      new Option(
        '--domain, -d <string>', 
        'Specify the base domain name. This is optional if hosting localtunnel from a regular example.com domain. This is required if hosting a localtunnel server from a subdomain (i.e. lt.example.dom where clients will be client-app.lt.example.com)'
      ).env('DOMAIN'))

    .addOption(new Option('--landing, -l <string>', 'The landing page for redirect from root domain').default('https://localtunnel.github.io/www/').env('LANDING'))
    
    .addOption(
      new Option('--max-sockets', 'maximum number of tcp sockets each client is allowed to establish at one time (the tunnels)')
        .argParser(intParser)
        .default(10)
        .env('MAX_SOCKETS')
    )
    .addOption(new Option('--range, -r <string>', 'bind incoming connections on ports specified in range xxxx:xxxx').argParser(rangeParser).env('RANGE'))
    .addOption(new Option('--secret, -s <string>', 'JWT shared secret used to encode tokens').env('SECRET'))
    
    .action(runServer)

  program.parse();
}

main().catch(e => console.error(e))
