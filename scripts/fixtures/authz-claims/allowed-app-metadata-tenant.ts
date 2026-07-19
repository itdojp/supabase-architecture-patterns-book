const tenantId = user.app_metadata?.tenant_id
if (typeof tenantId !== 'string') throw new Error('Missing tenant')
