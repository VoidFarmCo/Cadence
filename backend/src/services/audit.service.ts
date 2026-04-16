import prisma from '../lib/prisma';
import { AuditAction } from '@prisma/client';

export async function createAuditLog(params: {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  performedBy: string;
  reason?: string;
  oldValue?: unknown;
  newValue?: unknown;
  details?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        performed_by: params.performedBy,
        reason: params.reason,
        old_value: params.oldValue ? JSON.stringify(params.oldValue) : null,
        new_value: params.newValue ? JSON.stringify(params.newValue) : null,
        details: params.details,
      },
    });
  } catch (error) {
    // Audit log failures should not break the request
    console.error('Failed to create audit log:', error);
  }
}
