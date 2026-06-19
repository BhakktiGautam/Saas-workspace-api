'use strict';

jest.mock('../config/database', () => ({
  organizationMember: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  invitation: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((promises) => Promise.all(promises)),
}));

jest.mock('../config', () => ({
  invitation: {
    expiresInDays: 7,
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
}));

const prisma = require('../config/database');
const orgService = require('./organization.service');
const { NotFoundError } = require('../utils/errors');

describe('Organization Service - Soft Deletion and Invitation Bugs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserOrganizations', () => {
    it('should query only active organizations', async () => {
      prisma.organizationMember.findMany.mockResolvedValueOnce([]);
      prisma.organizationMember.count.mockResolvedValueOnce(0);

      await orgService.getUserOrganizations('user-1', { page: 1, limit: 10 });

      expect(prisma.organizationMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            organization: {
              isActive: true,
            },
          },
        })
      );
      expect(prisma.organizationMember.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organization: {
            isActive: true,
          },
        },
      });
    });
  });

  describe('acceptInvitation', () => {
    it('should throw NotFoundError if the organization is soft-deleted', async () => {
      const mockInvitation = {
        id: 'inv-1',
        token: 'token-abc',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
        organizationId: 'org-1',
        email: 'test@example.com',
        role: 'MEMBER',
        organization: {
          isActive: false,
        },
      };

      prisma.invitation.findUnique.mockResolvedValueOnce(mockInvitation);

      await expect(orgService.acceptInvitation('token-abc', 'user-1')).rejects.toThrow(NotFoundError);
    });
  });
});
