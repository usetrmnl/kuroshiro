const DEVICE_GROUPS_PATH = '/device-groups'

/** The Group's page, which the paths of its other pages start with. */
export const deviceGroupPath = (groupId: string) => `${DEVICE_GROUPS_PATH}/${groupId}`
