import { Test, TestingModule } from '@nestjs/testing';
import { FanProfilesController } from './fan-profiles.controller';
import { FanProfilesService } from './fan-profiles.service';

describe('FanProfilesController', () => {
  let controller: FanProfilesController;
  let service: {
    create: jest.Mock;
    findOne: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FanProfilesController],
      providers: [{ provide: FanProfilesService, useValue: service }],
    }).compile();

    controller = module.get<FanProfilesController>(FanProfilesController);
  });

  // Case 1: creating a valid profile delegates to the service and returns its result.
  it('creates a fan profile via the service', async () => {
    const dto = {
      email: 'fan@example.com',
      displayName: 'Fan Name',
      cityId: 'city-1',
    };
    const created = {
      id: 'profile-1',
      displayName: 'Fan Name',
      showOnMap: false,
      city: { id: 'city-1', name: 'Buenos Aires', country: {} },
    };
    service.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toBe(created);
  });

  // Case: getting an existing profile delegates to the service and returns its result.
  it('gets a fan profile via the service', async () => {
    const found = {
      id: 'profile-1',
      displayName: 'Fan Name',
      showOnMap: false,
      city: { id: 'city-1', name: 'Buenos Aires', country: {} },
    };
    service.findOne.mockResolvedValue(found);

    const result = await controller.findOne('profile-1');

    expect(service.findOne).toHaveBeenCalledWith('profile-1');
    expect(result).toBe(found);
  });

  // Case: listing fan profiles delegates to the service with the query and returns its result.
  it('lists fan profiles via the service', async () => {
    const query = { onMap: 'true' };
    const list = [
      {
        id: 'profile-1',
        displayName: 'Fan Name',
        showOnMap: true,
        city: { id: 'city-1', name: 'Buenos Aires', country: {} },
      },
    ];
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll(query);

    expect(service.findAll).toHaveBeenCalledWith(query);
    expect(result).toBe(list);
  });

  // Case: updating a profile delegates to the service and returns its result.
  it('updates a fan profile via the service', async () => {
    const dto = { displayName: 'New Name' };
    const updated = {
      id: 'profile-1',
      displayName: 'New Name',
      showOnMap: false,
      city: { id: 'city-1', name: 'Buenos Aires', country: {} },
    };
    service.update.mockResolvedValue(updated);

    const result = await controller.update('profile-1', dto);

    expect(service.update).toHaveBeenCalledWith('profile-1', dto);
    expect(result).toBe(updated);
  });
});
