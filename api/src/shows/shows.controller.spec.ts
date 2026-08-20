import { Test, TestingModule } from '@nestjs/testing';
import { ShowsController } from './shows.controller';
import { ShowsService } from './shows.service';

describe('ShowsController', () => {
  let controller: ShowsController;
  let service: {
    findAllByArtist: jest.Mock;
    findOne: jest.Mock;
    findSetlist: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findAllByArtist: jest.fn(),
      findOne: jest.fn(),
      findSetlist: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShowsController],
      providers: [{ provide: ShowsService, useValue: service }],
    }).compile();

    controller = module.get<ShowsController>(ShowsController);
  });

  it('returns the shows for an artist via the service', async () => {
    const shows = [{ id: 'show-1' }];
    service.findAllByArtist.mockResolvedValue(shows);

    const result = await controller.findAll('artist-1');

    expect(service.findAllByArtist).toHaveBeenCalledWith('artist-1');
    expect(result).toBe(shows);
  });

  it('gets a show via the service', async () => {
    const show = { id: 'show-1' };
    service.findOne.mockResolvedValue(show);

    const result = await controller.findOne('artist-1', 'show-1');

    expect(service.findOne).toHaveBeenCalledWith('artist-1', 'show-1');
    expect(result).toBe(show);
  });

  it('gets a setlist via the service', async () => {
    const setlist = { showId: 'show-1', songs: [] };
    service.findSetlist.mockResolvedValue(setlist);

    const result = await controller.findSetlist('artist-1', 'show-1');

    expect(service.findSetlist).toHaveBeenCalledWith('artist-1', 'show-1');
    expect(result).toBe(setlist);
  });
});
