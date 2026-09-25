import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CandidatesService } from './candidates.service';
import { CreateCandidateDto } from './create-candidate.dto';

@Injectable()
export class DemoSeedService implements OnModuleInit {
  constructor(private readonly config: ConfigService, private readonly candidates: CandidatesService) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('DEMO_MODE') !== 'true') return;
    await this.seed();
  }

  /** A, B and C from `seed/`, as inVision's platform would send them. Also what a demo reset ends with. */
  async seed(): Promise<void> {
    for (const letter of ['a', 'b', 'c']) {
      const filename = resolve(process.cwd(), '../../seed/candidates', letter, 'snapshot.json');
      const snapshot = JSON.parse(await readFile(filename, 'utf8')) as CreateCandidateDto;
      await this.candidates.upsert(snapshot, `Candidate ${letter.toUpperCase()}`);
    }
  }
}
