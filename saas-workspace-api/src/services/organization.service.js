'use strict';

/**
 * src/services/organization.service.js
 *
 * Business logic for organization management including:
 * - CRUD operations
 * - Member management
 * - Invitation system
 */

const prisma = require('../config/database');
const { generateUniqueSlug } = require('../utils/slug');
const { NotFoundError, ConflictError, AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');
const config = require('../config');

// ─── Create Organization ──────────────────────────────────────

async function createOrganization({ name, description }, ownerId) {
  const slug = generateUniqueSlug(name);

  // Use a transaction to create org + owner membership atomically
  const organization = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name, slug, description, ownerId },
    });

    // Owner is automatically added as a member with OWNER role
    await tx.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: ownerId,
        role: 'OWNER',
      },
    });

    return org;
  });

  logger.info({ orgId: organization.id, ownerId }, 'Organization created');
  return organization;
}

// ─── Get Organization ─────────────────────────────────────────

async function getOrganizationById(orgId) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId, isActive: true },
    include: {
      owner: {
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      },
      _count: { select: { members: true, projects: true } },
    },
  });

  if (!org) throw new NotFoundError('Organization');
  return org;
}

// ─── List User Organizations ──────────────────────────────────

async function getUserOrganizations(userId, { page, limit }) {
  const skip = (page - 1) * limit;

  const [memberships, total] = await prisma.$transaction([
    prisma.organizationMember.findMany({
      where: {
        userId,
        organization: {
          isActive: true,
        },
      },
      skip,
      take: limit,
      orderBy: { joinedAt: 'desc' },
      include: {
        organization: {
          include: {
            _count: { select: { members: true, projects: true } },
          },
        },
      },
    }),
    prisma.organizationMember.count({
      where: {
        userId,
        organization: {
          isActive: true,
        },
      },
    }),
  ]);

  return {
    items: memberships.map((m) => ({ ...m.organization, role: m.role, joinedAt: m.joinedAt })),
    total,
  };
}

// ─── Update Organization ──────────────────────────────────────

async function updateOrganization(orgId, data) {
  const org = await prisma.organization.update({
    where: { id: orgId },
    data,
  });
  logger.info({ orgId }, 'Organization updated');
  return org;
}

// ─── Delete Organization ──────────────────────────────────────

async function deleteOrganization(orgId, requestingUserId) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new NotFoundError('Organization');
  if (org.ownerId !== requestingUserId) {
    throw new AuthorizationError('Only the owner can delete an organization');
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { isActive: false },
  });

  logger.info({ orgId, requestingUserId }, 'Organization soft-deleted');
}

// ─── Members ──────────────────────────────────────────────────

async function getMembers(orgId, { page, limit }) {
  const skip = (page - 1) * limit;

  const [members, total] = await prisma.$transaction([
    prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      skip,
      take: limit,
      orderBy: { joinedAt: 'asc' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    }),
    prisma.organizationMember.count({ where: { organizationId: orgId } }),
  ]);

  return { items: members, total };
}

async function updateMemberRole(orgId, targetUserId, newRole, requestingMembership) {
  // Cannot change your own role
  if (targetUserId === requestingMembership.userId) {
    throw new AuthorizationError('You cannot change your own role');
  }

  // Find the target membership
  const targetMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
  });

  if (!targetMembership) throw new NotFoundError('Member');

  // Owners cannot be demoted by anyone except themselves (ownership transfer not in scope)
  if (targetMembership.role === 'OWNER') {
    throw new AuthorizationError('The owner role cannot be changed');
  }

  // Admins can only manage MEMBERs, not other ADMINs
  if (requestingMembership.role === 'ADMIN' && targetMembership.role === 'ADMIN') {
    throw new AuthorizationError('Admins cannot change the role of other admins');
  }

  // Admins cannot promote to OWNER
  if (requestingMembership.role === 'ADMIN' && newRole === 'OWNER') {
    throw new AuthorizationError('Only owners can grant the owner role');
  }

  const updated = await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    data: { role: newRole },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  logger.info({ orgId, targetUserId, newRole }, 'Member role updated');
  return updated;
}

async function removeMember(orgId, targetUserId, requestingMembership) {
  if (targetUserId === requestingMembership.userId) {
    throw new AuthorizationError('Use the leave endpoint to remove yourself');
  }

  const target = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
  });

  if (!target) throw new NotFoundError('Member');
  if (target.role === 'OWNER') {
    throw new AuthorizationError('The owner cannot be removed from the organization');
  }

  // Admins can only remove MEMBERs
  if (requestingMembership.role === 'ADMIN' && target.role === 'ADMIN') {
    throw new AuthorizationError('Admins cannot remove other admins');
  }

  await prisma.organizationMember.delete({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
  });

  logger.info({ orgId, targetUserId }, 'Member removed from organization');
}

// ─── Invitations ─────────────────────────────────────────────

async function inviteUser(orgId, { email, role }, invitedByUserId) {
  // Check for existing active membership
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: existingUser.id },
      },
    });
    if (alreadyMember) {
      throw new ConflictError('This user is already a member of the organization');
    }
  }

  // Check for pending invitation
  const pendingInvite = await prisma.invitation.findFirst({
    where: { organizationId: orgId, email, status: 'PENDING' },
  });
  if (pendingInvite) {
    throw new ConflictError('A pending invitation already exists for this email');
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.invitation.expiresInDays);

  const invitation = await prisma.invitation.create({
    data: {
      organizationId: orgId,
      invitedByUserId,
      invitedUserId: existingUser?.id ?? null,
      email,
      role,
      expiresAt,
    },
    include: {
      organization: { select: { name: true } },
      invitedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  logger.info({ orgId, email, invitedByUserId }, 'Invitation created');
  return invitation;
}

async function acceptInvitation(token, userId) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      organization: {
        select: { isActive: true },
      },
    },
  });

  if (!invitation || invitation.status !== 'PENDING' || !invitation.organization?.isActive) {
    throw new NotFoundError('Invitation');
  }

  if (invitation.expiresAt < new Date()) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
    throw new AuthorizationError('Invitation has expired');
  }

  // Confirm the accepting user's email matches the invitation
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user.email !== invitation.email) {
    throw new AuthorizationError('This invitation was sent to a different email address');
  }

  await prisma.$transaction([
    prisma.organizationMember.create({
      data: { organizationId: invitation.organizationId, userId, role: invitation.role },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', invitedUserId: userId },
    }),
  ]);

  logger.info({ invitationId: invitation.id, userId }, 'Invitation accepted');
  return { organizationId: invitation.organizationId };
}

module.exports = {
  createOrganization,
  getOrganizationById,
  getUserOrganizations,
  updateOrganization,
  deleteOrganization,
  getMembers,
  updateMemberRole,
  removeMember,
  inviteUser,
  acceptInvitation,
};
