'use strict';

jest.mock('../config/database', () => ({
  project: {
    findMany: jest.fn((args) => ({ model: 'project.findMany', args })),
    count: jest.fn((args) => ({ model: 'project.count', args })),
  },
  $transaction: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
}));

const prisma = require('../config/database');
const projectService = require('./project.service');

describe('projectService.listProjects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries projects with skip/take derived from validated pagination', async () => {
    const projects = [{ id: 'project-1', name: 'API Platform' }];
    prisma.$transaction.mockResolvedValueOnce([projects, 37]);

    const result = await projectService.listProjects('org-1', { page: 3, limit: 10 });

    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      skip: 20,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    expect(prisma.project.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      { model: 'project.findMany', args: expect.any(Object) },
      { model: 'project.count', args: expect.any(Object) },
    ]);
    expect(result).toEqual({ items: projects, total: 37 });
  });

  it('keeps status filtering scoped to the same paginated query and count', async () => {
    prisma.$transaction.mockResolvedValueOnce([[], 0]);

    await projectService.listProjects('org-1', { page: 1, limit: 20, status: 'ACTIVE' });

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', status: 'ACTIVE' },
        skip: 0,
        take: 20,
      })
    );
    expect(prisma.project.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', status: 'ACTIVE' },
    });
  });
});
