# Devices

A **Device** is a TRMNL e-ink display, or anything speaking its firmware's protocol, registered against your Kuroshiro instance. The Devices list shows what each one is showing right now, when it was last seen, its battery and any Alert it has open.

<ThemedShot name="devices" />

## Auto provisioning

Put the Device into Wi-Fi setup, join its `TRMNL` network and enter your Wi-Fi plus the server URL Kuroshiro shows you into the custom server field. The Device restarts, calls in, and appears on the Connect page the moment it does. No hardware at hand? Register a Device by hand, or use the [Device Simulator](./simulator).

<ThemedShot name="connect" />

## Settings

Each Device has its own Settings: its name, refresh rate, **Device Model** and **Palette**, its target **Firmware**, Sleep Mode, Mirroring, and a Device Reset.

<ThemedShot name="device-settings" />

- **Special Functions**: one-shot commands (`identify`, `sleep`, `add_wifi`, `rewind`) that reach the Device on its next poll and fire exactly once.
- **Sleep Mode**: a per-Device night window. While it is active the Rotation stops advancing and the Device is told to sleep until the window ends instead of polling on its usual cadence, optionally showing a dedicated sleep Screen.
- **Mirroring**: show the image of a Device on TRMNL's own server instead of the Device's own Rotation. If the mirrored MAC is the Device's own, Kuroshiro proxies TRMNL's `/display` response.

## Device Groups

A **Device Group** is a named set of Screens, with their Order and Schedules, that several Devices show together. Create one from the Devices list, add the Screens on the Group's page, then join Devices to it in the Group or in a Device's Settings.

<ThemedShot name="device-group" />

- **Joining**: a Device is in at most one Group, of any Device Model. Joining and leaving both reset its Rotation to the start of the Order.
- **What a member shows**: the Group's Screens, each rendered for the member's own Device Model and Palette. Every member walks the Order at its own pace, so two members can be on different Screens at the same moment. The Group's Screens are edited on the Group; on a member they are read-only.
- **Its own Screens**: a Device's own Screens are parked while it is a member, kept but not shown, and come back when it leaves.
- **Deleting a Group** makes every member leave, then deletes the Group's Screens.

## Live insights and Sensors

Wi-Fi signal, battery, firmware version and a preview of what the Device is showing. OG Devices with a Qwiic sensor add-on report CO₂, humidity, pressure and temperature on every poll; Kuroshiro keeps the latest reading and exposes it to every Plugin Template as `sensors.*`.

## Logs

Whatever the Device's firmware reports about itself is kept as its **Device Log**, until you clear it or the daily Retention job prunes it.

<ThemedShot name="device-logs" />
