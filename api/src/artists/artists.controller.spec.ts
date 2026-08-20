import { Test, TestingModule } from '@nestjs/testing';
import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';

describe('ArtistsController', () => {
  let controller: ArtistsController;
  let service: { findAll: jest.Mock; findOne: jest.Mock; findFans: jest.Mock };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findFans: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArtistsController],
      providers: [{ provide: ArtistsService, useValue: service }],
    }).compile();

    controller = module.get<ArtistsController>(ArtistsController);
  });

  it('returns the artists from the service', async () => {
    const artists = [
      {
        id: 'artist-1',
        name: 'The Warning',
        slug: 'the-warning',
        imageUrl: null,
      },
    ];
    service.findAll.mockResolvedValue(artists);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
    expect(result).toBe(artists);
  });

  it('gets an artist via the service', async () => {
    const artist = {
      id: 'artist-1',
      name: 'The Warning',
      slug: 'the-warning',
      imageUrl: null,
    };
    service.findOne.mockResolvedValue(artist);

    const result = await controller.findOne('artist-1');

    expect(service.findOne).toHaveBeenCalledWith('artist-1');
    expect(result).toBe(artist);
  });

  it('gets an artist fans via the service', async () => {
    const response = {
      artist: { id: 'artist-1', name: 'The Warning', slug: 'the-warning', imageUrl: null },
      fans: [],
    };
    service.findFans.mockResolvedValue(response);

    const result = await controller.findFans('artist-1', { onMap: 'true' });

    expect(service.findFans).toHaveBeenCalledWith('artist-1', { onMap: 'true' });
    expect(result).toBe(response);
  });
});
