<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import type { SettingsReference } from './deviceSettings'
import PageSection from '@/patterns/PageSection.vue'
import { SETTINGS_SECTIONS } from './deviceSettings'
import SettingsDeviceGroup from './SettingsDeviceGroup.vue'
import SettingsDeviceModel from './SettingsDeviceModel.vue'
import SettingsName from './SettingsName.vue'
import SettingsPalette from './SettingsPalette.vue'
import SettingsRefreshRate from './SettingsRefreshRate.vue'
import SettingsRotationMode from './SettingsRotationMode.vue'

defineProps<{
  device: DeviceDetail
  reference: SettingsReference
}>()
</script>

<template>
  <PageSection :id="SETTINGS_SECTIONS.display" title="Display" rows>
    <SettingsName :device="device" />
    <SettingsDeviceModel :device="device" :models="reference.models" />
    <SettingsPalette :device="device" :reference="reference" />
    <SettingsRefreshRate :device="device" />
    <SettingsRotationMode :device="device" />
    <SettingsDeviceGroup :device="device" :groups="reference.groups" />
  </PageSection>
</template>
