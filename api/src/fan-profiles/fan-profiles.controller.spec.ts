import { FanProfilesController } from './fan-profiles.controller';
import { FanProfilesService } from './fan-profiles.service';

// Instanciado directamente (no vía Test.createTestingModule) siguiendo el
// mismo patrón que auth.controller.spec.ts: @UseGuards(SessionAuthGuard) es
// metadata de routing que solo se ejercita levantando el pipeline HTTP real,
// no al construir el controller a mano — ver el 401 sin sesión end-to-end
// en fan-profiles.e2e-spec.ts.
describe('FanProfilesController', () => {
  let controller: FanProfilesController;
  let service: {
    create: jest.Mock;
    findOne: jest.Mock;
    findMine: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    findFavoriteSongsRanking: jest.Mock;
  };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findOne: jest.fn(),
      findMine: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      findFavoriteSongsRanking: jest.fn(),
    };

    controller = new FanProfilesController(
      service as unknown as FanProfilesService,
    );
  });

  // Case 1: creating a valid profile derives the userId from request.user
  // (populated by SessionAuthGuard) and delegates to the service.
  it('creates a fan profile via the service, using request.user.id as the userId', async () => {
    const dto = {
      displayName: 'Fan Name',
      cityId: 'city-1',
    };
    const req = { user: { id: 'user-1', email: 'fan@example.com' } } as any;
    const created = {
      id: 'profile-1',
      displayName: 'Fan Name',
      showOnMap: false,
      city: { id: 'city-1', name: 'Buenos Aires', country: {} },
    };
    service.create.mockResolvedValue(created);

    const result = await controller.create(req, dto);

    expect(service.create).toHaveBeenCalledWith('user-1', dto);
    expect(result).toBe(created);
  });

  // Case 5: no acepta userId del body — la firma del método ni siquiera lo
  // recibe del DTO, solo de request.user.
  it('ignores any userId present on the request body and uses request.user.id instead', async () => {
    const dto = {
      displayName: 'Fan Name',
      cityId: 'city-1',
      userId: 'attacker-chosen-user',
    } as any;
    const req = { user: { id: 'user-1', email: 'fan@example.com' } } as any;
    service.create.mockResolvedValue({});

    await controller.create(req, dto);

    expect(service.create).toHaveBeenCalledWith('user-1', dto);
  });

  // Etapa 3: GET /fan-profiles/me resuelve por request.user.id, nunca por
  // un :id de la URL — el cliente no puede pedir el perfil de otro user.
  it('gets the authenticated user\'s own fan profile via the service', async () => {
    const req = { user: { id: 'user-1', email: 'fan@example.com' } } as any;
    const found = {
      id: 'profile-1',
      displayName: 'Fan Name',
      showOnMap: false,
      city: { id: 'city-1', name: 'Buenos Aires', country: {} },
    };
    service.findMine.mockResolvedValue(found);

    const result = await controller.findMine(req);

    expect(service.findMine).toHaveBeenCalledWith('user-1');
    expect(result).toBe(found);
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

  // Etapa 4: PATCH delega a request.user.id como owner, igual que POST — el
  // service es quien decide si ese userId es efectivamente el dueño.
  it('updates a fan profile via the service, using request.user.id as the owner', async () => {
    const dto = { displayName: 'New Name' };
    const req = { user: { id: 'user-1', email: 'fan@example.com' } } as any;
    const updated = {
      id: 'profile-1',
      displayName: 'New Name',
      showOnMap: false,
      city: { id: 'city-1', name: 'Buenos Aires', country: {} },
    };
    service.update.mockResolvedValue(updated);

    const result = await controller.update(req, 'profile-1', dto);

    expect(service.update).toHaveBeenCalledWith('profile-1', 'user-1', dto);
    expect(result).toBe(updated);
  });

  // Etapa "Setlist + Top 10 independientes": ranking del Fan Map, público,
  // sin sesión.
  it('gets the favorite songs ranking via the service, with the given filters', async () => {
    const query = { countryId: 'country-1' };
    const ranking = [{ songId: 'song-1', title: 'MORE', albumTitle: null, count: 5 }];
    service.findFavoriteSongsRanking.mockResolvedValue(ranking);

    const result = await controller.findFavoriteSongsRanking(query);

    expect(service.findFavoriteSongsRanking).toHaveBeenCalledWith(query);
    expect(result).toBe(ranking);
  });
});
